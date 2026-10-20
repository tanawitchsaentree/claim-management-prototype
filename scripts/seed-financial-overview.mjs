/**
 * seed-financial-overview.mjs
 *
 * Gives every seeded claim a financial overview (payments, reserves, recovery
 * bookings, transactions, section summaries) built from the stores that already
 * exist, so Payments / Reserves / Recovery bookings / Financial Overview are
 * never empty for a claim that has a policy. Re-runnable: it keeps the first
 * entry of financial-overview.json (CLM-2024-001, which the GG tickets depend
 * on) byte-for-byte and regenerates everything after it.
 *
 *   node scripts/seed-financial-overview.mjs
 *
 * Sources: claims.json (currency, lossAmount, client, handler, status),
 * parties.json, sections.json, approvals.json (reserve requests become Pending
 * reserve rows), payment-approvals.json (kept with the same ids),
 * reserve-movements.json (reserve history), recovery-cases.json (recovered
 * amounts), claim-overview.json (totals the rows must add up to), policies.json
 * (client code for ids). Nothing here is random: every number follows from the
 * claim's own record, so the output is stable.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = f => JSON.parse(readFileSync(resolve(root, 'src/app/core/mock/data', f), 'utf8'));
const claims = data('claims.json');
const parties = data('parties.json');
const sections = data('sections.json');
const approvals = data('approvals.json');
const payAppr = data('payment-approvals.json');
const movements = data('reserve-movements.json');
const recoveryCases = data('recovery-cases.json');
const overviews = data('claim-overview.json');
const policies = data('policies.json');
const outPath = resolve(root, 'src/app/core/mock/data/financial-overview.json');
const existing = JSON.parse(readFileSync(outPath, 'utf8'));
const keep = existing.filter(f => f.claimId === 'CLM-2024-001');

// ── small helpers ──────────────────────────────────────────────────────────────
const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const stepFor = n => (n >= 100000 ? 1000 : n >= 10000 ? 500 : n >= 1000 ? 50 : 10);
const round = n => Math.round(n / stepFor(n)) * stepFor(n);
const sum = (rows, f) => rows.reduce((t, r) => t + f(r), 0);
const ddmmyyyy = iso => iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4);
// claims.json writes some dates as "today-Nd" placeholders resolved at run time;
// seeded rows need a fixed date, so they are baked against this day.
const TODAY = '2026-10-20';
const isoOf = v => {
  const m = /^today(?:-(\d+)d)?$/.exec(v);
  return m ? new Date(new Date(TODAY).getTime() - Number(m[1] ?? 0) * 86400000).toISOString().slice(0, 10) : v;
};
const addDays = (iso, d) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().slice(0, 10);

/** Split `total` into `n` parts with fixed weights; the last part takes the rounding remainder. */
function split(total, weights) {
  const w = weights.reduce((a, b) => a + b, 0);
  const parts = weights.slice(0, -1).map(x => round((total * x) / w));
  parts.push(total - parts.reduce((a, b) => a + b, 0));
  return parts;
}

// Same readings as the app: requester email -> display name (RequesterNamePipe).
function requesterName(email) {
  if (email === 'n.feld@allianz.com') return 'Nina Feld';
  const local = email.split('@')[0];
  const ext = local.startsWith('extern.');
  const f = (ext ? local.slice(7) : local)
    .split('.')
    .filter(Boolean)
    .map(p => (p.length <= 2 ? p[0].toUpperCase() + '.' : p[0].toUpperCase() + p.slice(1)))
    .join(' ');
  return ext ? `${f} (External)` : f;
}

const SECTION_CODES = { 'material-damage': 'PD', 'business-interruption': 'BI' };
const sectionCodeFor = t =>
  SECTION_CODES[t] ?? t.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());

const LOB = {
  Property: { item: 'Building 1', sub: 'Property Damage', exp: 'Loss Adjustor fees' },
  Marine: { item: 'Cargo 1', sub: 'Cargo Damage', exp: 'Survey fees' },
  Cyber: { item: 'IT systems 1', sub: 'Data Restoration', exp: 'Forensics' },
  Liability: { item: 'Third party 1', sub: 'Third-Party Liability', exp: 'Legal costs' },
  Engineering: { item: 'Machinery 1', sub: 'Machinery Damage', exp: 'Expert fees' }
};

// ── per-claim builder ──────────────────────────────────────────────────────────
function build(claim) {
  const id = claim.claimId;
  const lob = LOB[claim.lineOfBusiness] ?? LOB.Property;
  const overview = overviews[id];
  const closed = claim.status === 'Closed';
  const handler = claim.assignee || claim.createdBy;
  const policy = policies.find(p => p.policyNumber === claim.policyNumber);
  const clientCode = policy?.clientNameCode ?? 'C-00000000';
  const created = isoOf(claim.dateCreated);
  const updated = isoOf(claim.dateUpdated);
  const year = created.slice(0, 4);
  const claimNo = id.match(/(\d+)$/)?.[1] ?? '0';
  const cur = claim.currency;
  const secs = sections.filter(s => s.claimId === id);
  const claimParties = parties.filter(p => p.claimId === id);
  const mv = movements.filter(m => m.claimId === id).sort((a, b) => a.date.localeCompare(b.date));
  const myApprovals = approvals.filter(a => a.claimId === id);
  const myPayApprovals = payAppr.filter(a => a.claimId === id);

  // Scale: what the claim is worth. A claim with no usable loss amount (0, or the
  // 999,999,999 overflow test value) takes its last reserve movement, else a small base.
  const lossOk = claim.lossAmount > 0 && claim.lossAmount < 50_000_000;
  const scale = lossOk ? claim.lossAmount : mv.length ? mv[mv.length - 1].amountAfter : 18000;

  // Money position. Explicit totals in claim-overview.json win; otherwise an open
  // claim is 35% paid / 65% reserved (movement claims: the reserve IS the movement
  // total and about 20% of it has been paid), a closed claim is fully paid.
  let reserveTotal, paidTotal;
  if (overview && id !== 'CL-2025-001') {
    reserveTotal = overview.financialSummary.totalReserve;
    paidTotal = overview.financialSummary.totalPayments;
  } else if (id === 'CL-2025-001') {
    reserveTotal = 1250000;
    paidTotal = 320000;
  } else if (closed) {
    reserveTotal = 0;
    paidTotal = scale;
  } else if (mv.length) {
    reserveTotal = mv[mv.length - 1].amountAfter;
    paidTotal = round(reserveTotal * 0.2);
  } else {
    paidTotal = round(scale * 0.35);
    reserveTotal = scale - paidTotal;
  }

  // payee pool: the claim's own client, its parties, its broker
  const partyNames = claimParties
    .filter(p => p.roles.some(r => ['client', 'claimant', 'insured', 'third-party', 'expert'].includes(r)))
    .map(p => p.legalName);
  const payees = [...new Set([claim.clientName, ...partyNames, claim.broker].filter(Boolean))];
  const party = claim.clientName;

  // ── reserves ────────────────────────────────────────────────────────────────
  const finSections = secs.map(s => ({
    sectionId: s.id,
    sectionName: s.name,
    code: sectionCodeFor(s.damageType),
    currency: cur,
    exchangeRate: 1,
    baseCurrency: cur,
    summaryRows: [],
    payments: [],
    reserves: [],
    recoveries: []
  }));
  const reserves = [];
  const nextReserveId = (sectionId, item) => {
    const sectionNo = sectionId ? finSections.findIndex(s => s.sectionId === sectionId) + 1 : 0;
    const inSection = reserves.filter(r => (r.sectionId ?? undefined) === sectionId);
    const items = [...new Set(inSection.map(r => r.damagedItem).filter(Boolean))];
    const itemNo = item ? (items.includes(item) ? items.indexOf(item) : items.length) + 1 : 0;
    const reserveNo = inSection.filter(r => (r.damagedItem || '') === (item || '')).length + 1;
    return `RES-${clientCode}-${year}.${claimNo}.${sectionNo}.${itemNo}.${reserveNo}`;
  };
  const histDate = iso => ddmmyyyy(iso);
  const mkReserve = (value, { section, type, sub, item, history, status = 'Approved', requestedBy, currency = cur }) => {
    const r = {
      reserveId: nextReserveId(section?.id, item),
      party,
      damagedItem: item,
      section: section ? section.name : 'Claim level',
      reserveType: type,
      reserveSubType: sub,
      status,
      reserveValue: value,
      currency,
      history,
      ...(section ? { sectionCode: sectionCodeFor(section.damageType), sectionId: section.id } : {}),
      ...(requestedBy ? { requestedBy } : {})
    };
    reserves.push(r);
    return r;
  };
  const initialUser = handler;
  const openSecs = secs.filter(s => s.status !== 'Closed');
  const closedSecs = secs.filter(s => s.status === 'Closed');
  const released = (section, item, type, sub) =>
    mkReserve(0, {
      section,
      type,
      sub,
      item,
      history: [
        { date: histDate(addDays(created, 3)), amount: round(scale * 0.1), reason: 'Initial reserve set', user: initialUser },
        { date: histDate(updated), amount: 0, reason: 'Released on closure', user: initialUser }
      ]
    });

  if (closed || reserveTotal === 0) {
    // closed claim / closed sections: reserves released to zero, still listed
    (secs.length ? secs : [null]).forEach(s => released(s, lob.item, 'Indemnity', lob.sub));
  } else if (secs.length) {
    const targets = openSecs.length ? openSecs : secs;
    split(reserveTotal, targets.map(() => 1)).forEach((v, i) =>
      mkReserve(v, {
        section: targets[i],
        type: 'Indemnity',
        sub: targets[i].damageType === 'business-interruption' ? 'Business Interruption' : lob.sub,
        item: lob.item,
        history: [
          { date: histDate(addDays(created, 3)), amount: round(v * 0.7), reason: 'Initial reserve set', user: initialUser },
          { date: histDate(addDays(created, 40)), amount: v, reason: 'Revised after adjuster report', user: initialUser }
        ]
      })
    );
    closedSecs.forEach(s => released(s, lob.item, 'Indemnity', lob.sub));
  } else if (mv.length) {
    // one reserve whose history is the claim's reserve movements, oldest first
    mkReserve(reserveTotal, {
      type: 'Indemnity',
      sub: lob.sub,
      item: lob.item,
      history: [
        { date: histDate(addDays(mv[0].date, -30)), amount: mv[0].amountBefore, reason: 'Initial reserve set', user: initialUser },
        ...mv.map(m => ({ date: histDate(m.date), amount: m.amountAfter, reason: m.reason, user: initialUser }))
      ]
    });
  } else if (id === 'CL-2025-001') {
    split(reserveTotal, [3, 2, 1]).forEach((v, i) =>
      mkReserve(v, {
        type: i === 2 ? 'Expenses' : 'Indemnity',
        sub: i === 2 ? lob.exp : lob.sub,
        item: i === 2 ? '' : `Building ${i + 1}`,
        history: [
          { date: histDate(addDays(created, 2)), amount: round(v * 0.8), reason: 'Initial reserve set', user: initialUser },
          { date: histDate(addDays(created, 30)), amount: v, reason: 'Revised after adjuster report', user: initialUser }
        ]
      })
    );
  } else {
    const [ind, exp] = split(reserveTotal, [85, 15]);
    mkReserve(ind, {
      type: 'Indemnity',
      sub: lob.sub,
      item: lob.item,
      history: [
        { date: histDate(addDays(created, 3)), amount: round(ind * 0.75), reason: 'Initial reserve set', user: initialUser },
        { date: histDate(addDays(created, 35)), amount: ind, reason: 'Revised after adjuster report', user: initialUser }
      ]
    });
    mkReserve(exp, {
      type: 'Expenses',
      sub: lob.exp,
      item: '',
      history: [{ date: histDate(addDays(created, 3)), amount: exp, reason: 'Initial reserve set', user: initialUser }]
    });
  }
  // every reserve approval becomes a Pending reserve row on its claim
  for (const a of myApprovals) {
    const principal = reserves[0];
    mkReserve(a.amount, {
      section: principal.sectionId ? secs.find(s => s.id === principal.sectionId) : null,
      type: a.reserveType,
      sub: principal.reserveSubType,
      item: principal.damagedItem,
      status: 'Pending',
      currency: a.currency,
      requestedBy: a.requester,
      history: [{ date: '18-10-2026', amount: a.amount, reason: 'Reserve increase requested', user: requesterName(a.requester) }]
    });
  }

  // ── payments ────────────────────────────────────────────────────────────────
  const payments = [];
  const pay = (n, seq, status, amount, payee, type, date) =>
    payments.push({
      paymentId: `PMT-${clientCode}-${year}.${claimNo}.1.${seq}`,
      reinsuranceId: `R${String(10000 + (hash(id + seq) % 89999))}`.slice(0, 6),
      payee,
      handler,
      sectionType: type,
      status,
      amount,
      currency: cur,
      paymentDate: ddmmyyyy(date)
    });
  const lastDate = closed ? updated : addDays(created, 90);
  let seq = 1;
  const placement = []; // which section each payment belongs to, in payments order
  if (paidTotal > 0) {
    const n = paidTotal >= 40000 ? 3 : 2;
    const weights = n === 3 ? [5, 3, 2] : [3, 2];
    split(paidTotal, weights).forEach((v, i) => {
      const day = addDays(created, Math.min(14 + i * 20, 85));
      pay(n, seq, 'Done', v, payees[i % payees.length], i === n - 1 && n === 3 ? 'Expenses' : 'Indemnity', day > lastDate ? lastDate : day);
      placement.push(secs.length ? secs[i % secs.length].id : null);
      seq++;
    });
  } else {
    // nothing completed yet (e.g. CLM-2024-003): payments are on their way
    const base = round(scale * 0.08);
    [['Pending', base, 'Indemnity'], ['Pending', round(base * 0.6), 'Expenses'], ['Draft', round(base * 0.3), 'Expenses']].forEach(([st, v, t], i) => {
      pay(3, seq, st, v, payees[i % payees.length], t, addDays(created, 30 + i * 10));
      placement.push(secs.length ? secs[i % secs.length].id : null);
      seq++;
    });
  }
  // payments waiting in Approvals stay on the claim, same id, amount, payee
  for (const a of myPayApprovals) {
    payments.push({
      paymentId: a.paymentId,
      reinsuranceId: '',
      payee: a.payee,
      handler: requesterName(a.requester),
      sectionType: { Indemnity: 'Indemnity', Settlement: 'Indemnity', Expense: 'Expenses', Provider: 'Expenses' }[a.paymentType],
      status: 'Pending',
      amount: a.amount,
      currency: a.currency,
      paymentDate: '18-10-2026'
    });
    placement.push(null);
  }

  // ── recoveries ──────────────────────────────────────────────────────────────
  const recoveries = [];
  const recSection = i => (secs.length ? secs[i % secs.length] : null);
  const mkRec = (n, type, status, amount, recParty, section, date) =>
    recoveries.push({
      recoveryId: `REC-${claimNo}-${String(n).padStart(2, '0')}`,
      bookingId: `DED-${claimNo}-${n}`,
      reinsuranceId: `RI${String(1000 + (hash(id + n) % 8999))}`,
      party: recParty,
      section: section ? section.name : 'Claim level',
      recoveryType: type,
      status,
      amount,
      currency: cur,
      recoveryDate: ddmmyyyy(date),
      bookingDate: ddmmyyyy(date)
    });
  const myCases = recoveryCases.filter(c => c.claimId === id);
  if (id === 'CL-2025-001') {
    mkRec(1, 'Reinsurance', 'Approved', 30000, 'Munich Re', null, addDays(created, 50));
    mkRec(2, 'Deductible', 'Approved', 15000, claim.clientName, null, addDays(created, 60));
  } else if (myCases.length) {
    myCases.forEach((c, i) => {
      if (c.recoveredAmount > 0) mkRec(i + 1, c.route, 'Approved', c.recoveredAmount, c.counterparty, null, c.resolvedDate);
      else mkRec(i + 1, c.route, 'Pending', c.estimatedAmount, c.counterparty, null, c.expectedDate ?? addDays(created, 120));
    });
  } else {
    // claim-overview.json says 0 recovered for 011 / 024: their booking waits for approval
    const zeroRecovered = overview && overview.financialSummary.totalRecoveries === 0;
    mkRec(1, 'Deductible', zeroRecovered ? 'Pending' : 'Approved', Math.max(round(scale * 0.04), 100), claim.clientName, recSection(0), addDays(created, 45));
    if (!closed && !zeroRecovered && scale >= 90000) mkRec(2, 'Reinsurance', 'Pending', round(scale * 0.1), 'Munich Re', recSection(1), addDays(created, 70));
  }
  const recoveryOverride = overview?.financialSummary.totalRecoveries;

  // ── sections ────────────────────────────────────────────────────────────────
  finSections.forEach(fs => {
    fs.reserves = [];
    fs.payments = payments.filter((p, i) => placement[i] === fs.sectionId);
    fs.recoveries = recoveries.filter(r => r.section === fs.sectionName);
    const rowsFor = type => {
      const rs = reserves.filter(r => r.sectionId === fs.sectionId && r.reserveType.startsWith(type) && r.status !== 'Rejected');
      const ps = fs.payments.filter(p => p.sectionType === type || (type === 'Expenses' && p.sectionType === 'Expenses'));
      const outstanding = sum(rs, r => r.reserveValue);
      const completed = sum(ps.filter(p => p.status === 'Done'), p => p.amount);
      return {
        movementType: type,
        outstandingReserves: outstanding,
        completedPayments: completed,
        pendingPayments: sum(ps.filter(p => p.status === 'Pending'), p => p.amount),
        recoveries: type === 'Indemnity' ? sum(fs.recoveries.filter(r => r.status === 'Approved'), r => r.amount) : 0,
        incurred: outstanding + completed
      };
    };
    const rows = [rowsFor('Expenses'), rowsFor('Indemnity')];
    const total = { movementType: 'Total' };
    for (const k of ['outstandingReserves', 'completedPayments', 'pendingPayments', 'recoveries', 'incurred']) total[k] = sum(rows, r => r[k]);
    fs.summaryRows = [...rows, total];
  });

  // ── totals, details, transactions ───────────────────────────────────────────
  // Rows in another currency than the claim's (a few approvals are EUR on CHF claims) stay listed but are not added into claim-currency sums.
  const own = r => r.currency === cur;
  const outstandingRes = sum(reserves.filter(r => r.status !== 'Rejected' && own(r)), r => r.reserveValue);
  const completed = sum(payments.filter(p => own(p) && (p.status === 'Done' || p.status === 'Credit')), p => p.amount);
  const pending = sum(payments.filter(p => own(p) && p.status === 'Pending'), p => p.amount);
  const recovered = sum(recoveries.filter(r => r.status === 'Approved'), r => r.amount);
  const outstandingShown = id === 'CL-2025-001' ? overview.financialSummary.outstanding : outstandingRes;
  const incurred = id === 'CL-2025-001' ? reserveTotal : outstandingShown + completed;
  const detail = (label, gross) => ({ label, gross, grossNet: Math.round(gross * 0.9), net: Math.round(gross * 0.85) });
  let run = 0;
  const transactions = [];
  payments.filter(p => p.status === 'Done').forEach((p, i) => {
    run += p.amount;
    transactions.push({
      transactionId: `T-${String(i + 1).padStart(3, '0')}`,
      date: p.paymentDate.replace(/-/g, '.'),
      description: `Payment: ${p.payee} — ${cur}/${cur} × 1.00`,
      indemnityPayment: p.sectionType === 'Indemnity' ? p.amount : 0,
      expensePayment: p.sectionType === 'Expenses' ? p.amount : 0,
      totalPayment: p.amount,
      indemnityRecovery: 0,
      expenseRecovery: 0,
      totalRecovery: 0,
      recoveries: 0,
      totalIncurred: run
    });
  });
  reserves.filter(r => r.status === 'Approved' && r.reserveValue > 0).forEach((r, i) => {
    run += r.reserveValue;
    transactions.push({
      transactionId: `T-${String(transactions.length + 1).padStart(3, '0')}`,
      date: r.history[0].date.replace(/-/g, '.'),
      description: `Reserve: ${r.reserveSubType} — ${cur}/${cur} × 1.00`,
      indemnityPayment: 0,
      expensePayment: 0,
      totalPayment: 0,
      indemnityRecovery: r.reserveType === 'Indemnity' ? r.reserveValue : 0,
      expenseRecovery: r.reserveType === 'Expenses' ? r.reserveValue : 0,
      totalRecovery: r.reserveValue,
      recoveries: 0,
      totalIncurred: run
    });
  });
  if (recoveryOverride !== undefined && recovered !== recoveryOverride && id !== 'CL-2025-001' && id !== 'CLM-2024-003') {
    throw new Error(`${id}: recoveries ${recovered} != claim-overview ${recoveryOverride}`);
  }
  return {
    claimId: id,
    summary: { outstandingReserves: outstandingShown, completedPayments: completed, pendingPayments: pending, recoveries: recovered, incurred },
    details: {
      currency: cur,
      ibnr: 0,
      rows: [detail('Insured', incurred), detail('Reserve', outstandingShown), detail('Payments', completed), detail('Recoveries', recovered)]
    },
    payments,
    reserves,
    recoveries,
    transactions,
    sections: finSections
  };
}

// ── run ─────────────────────────────────────────────────────────────────────────
const noMoney = c => c.claimId.startsWith('SK-') && ['awaiting-policy', 'abandoned'].includes(c.skeletonState);
const targets = claims.filter(c => c.claimId !== 'CLM-2024-001' && !noMoney(c));
const seeded = targets.map(build);
// CL-2025-001 is the claim most tickets use but it is not in claims.json: build it from its overview record.
const o = overviews['CL-2025-001'];
seeded.push(
  build({
    claimId: 'CL-2025-001',
    clientName: o.client,
    assignee: o.assignedHandler,
    createdBy: o.assignedHandler,
    policyNumber: o.policyNumber,
    lineOfBusiness: o.lineOfBusiness,
    currency: o.financialSummary.currency,
    lossAmount: 1250000,
    status: o.status,
    dateCreated: o.dateCreated,
    dateUpdated: o.dateCreated
  })
);

// consistency checks against claim-overview.json
const bad = [];
for (const f of seeded) {
  const ov = overviews[f.claimId]?.financialSummary;
  if (!ov) continue;
  const pays = f.summary.completedPayments;
  if (pays !== ov.totalPayments) bad.push(`${f.claimId} payments ${pays} != ${ov.totalPayments}`);
  const res = f.reserves.filter(r => r.status === 'Approved').reduce((t, r) => t + r.reserveValue, 0);
  if (res !== ov.totalReserve) bad.push(`${f.claimId} approved reserves ${res} != ${ov.totalReserve}`);
  if (f.summary.recoveries !== ov.totalRecoveries) bad.push(`${f.claimId} recoveries ${f.summary.recoveries} != ${ov.totalRecoveries}`);
}
if (bad.length) {
  console.error('Totals do not match claim-overview.json:\n  ' + bad.join('\n  '));
  process.exit(1);
}
writeFileSync(outPath, JSON.stringify([...keep, ...seeded], null, 2) + '\n');
console.log(`Seeded ${seeded.length} claims: ${seeded.map(f => f.claimId).join(', ')}`);
