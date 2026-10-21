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
// sections this script created in an earlier run (ids SEC-C...) are rebuilt, everything else is kept as is
const sections = data('sections.json').filter(x => !x.id.startsWith('SEC-C'));
const generatedSections = [];
const users = [...data('users.json'), ...data('user-directory.json')];
const providerAssignments = data('provider-assignments.json');
const thirdParties = data('third-parties.json');
const approvals = data('approvals.json');
const payAppr = data('payment-approvals.json');
const movements = data('reserve-movements.json');
const recoveryCases = data('recovery-cases.json');
const overviews = data('claim-overview.json');
const policies = data('policies.json');
const lookups = data('lookups.json');
const lossInfoPath = resolve(root, 'src/app/core/mock/data/loss-information.json');
const lossInfo = JSON.parse(readFileSync(lossInfoPath, 'utf8'));
const outPath = resolve(root, 'src/app/core/mock/data/financial-overview.json');
const existing = JSON.parse(readFileSync(outPath, 'utf8'));
const keep = existing.filter(f => f.claimId === 'CLM-2024-001');
// Payments waiting in Approvals use the claim's own id format. CLM-2024-001's rows are
// 123456-<n>; -6 to -11 are taken by the GG preset payments, so its approval row is -12.
const OWN_PAYMENT_ID_001 = '123456-12';
payAppr.filter(a => a.claimId === 'CLM-2024-001').forEach(a => (a.paymentId = OWN_PAYMENT_ID_001));
// Staff are never payees: internal users, and every handler / creator named in claims.json.
const staff = new Set([...users.map(u => u.name), ...claims.flatMap(c => [c.assignee, c.createdBy])].filter(Boolean));

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

// Scale: what the claim is worth. A claim with no usable loss amount (0, or the
// 999,999,999 overflow test value) takes its last reserve movement, else a small base.
function scaleOf(claim) {
  const mvs = movements.filter(m => m.claimId === claim.claimId).sort((a, b) => a.date.localeCompare(b.date));
  const lossOk = claim.lossAmount > 0 && claim.lossAmount < 50_000_000;
  return lossOk ? claim.lossAmount : mvs.length ? mvs[mvs.length - 1].amountAfter : 18000;
}

// A reserve always belongs to a section. Claims with no sections in sections.json get one or
// two, named from their line of business and location (second one only on bigger losses).
const SECTION_PLAN = {
  Property: [['material-damage', 'Property damage'], ['business-interruption', 'Business interruption', 100000]],
  Marine: [['material-damage', 'Cargo damage'], ['liability', 'Carrier liability', 150000]],
  Cyber: [['business-interruption', 'System outage & recovery'], ['material-damage', 'Data restoration', 50000]],
  Liability: [['liability', 'Third-party liability']],
  Engineering: [['machinery-breakdown', 'Machinery breakdown'], ['business-interruption', 'Business interruption', 300000]]
};
function ensureSections(claim) {
  const id = claim.claimId;
  if (sections.some(x => x.claimId === id)) return;
  const claimNo = id.match(/(\d+)$/)?.[1] ?? '0';
  const closed = claim.status === 'Closed';
  const scale = scaleOf(claim);
  const plan = (SECTION_PLAN[claim.lineOfBusiness] ?? SECTION_PLAN.Property).filter(([, , min]) => !min || scale >= min);
  const city = claim.location?.city;
  plan.forEach(([damageType, label], i) => {
    const sec = {
      id: `SEC-C-${id}-${i + 1}`,
      claimId: id,
      name: city ? `${label} \u2014 ${city}` : label,
      damageType,
      status: closed ? 'Closed' : 'Open',
      expanded: true,
      hasOpenDeductible: false,
      hasActiveLitigation: false,
      hasSubrogation: false,
      hasActiveSalvage: false,
      hasOpenReserves: false,
      hasOpenPayments: false,
      hasActiveProvider: false,
      ...(closed
        ? { closureDate: isoOf(claim.dateUpdated), closedBy: { userId: 'usr-cm', name: claim.assignee || claim.createdBy } }
        : {}),
      entities: [
        {
          id: `SE-C-${id}-${i + 1}`,
          name: `${claim.clientName} \u2014 ${label}`,
          instructionStatus: closed ? 'Completed' : 'Not assigned',
          expandable: false
        }
      ]
    };
    sections.push(sec);
    generatedSections.push(sec);
  });
}

/** Summary and details are the sums of the rows (claim-currency rows only). */
function summarize(cur, payments, reserves, recoveries) {
  const own = r => r.currency === cur;
  const outstanding = sum(reserves.filter(r => r.status !== 'Rejected' && own(r)), r => r.reserveValue);
  const completed = sum(payments.filter(p => own(p) && (p.status === 'Done' || p.status === 'Credit')), p => p.amount);
  const pending = sum(payments.filter(p => own(p) && p.status === 'Pending'), p => p.amount);
  const recovered = sum(recoveries.filter(r => own(r) && r.status === 'Approved'), r => r.amount);
  const incurred = outstanding + completed;
  const detail = (label, gross) => ({ label, gross, grossNet: Math.round(gross * 0.9), net: Math.round(gross * 0.85) });
  return {
    summary: { outstandingReserves: outstanding, completedPayments: completed, pendingPayments: pending, recoveries: recovered, incurred },
    details: { currency: cur, ibnr: 0, rows: [detail('Insured', incurred), detail('Reserve', outstanding), detail('Payments', completed), detail('Recoveries', recovered)] }
  };
}

/** A section's Expenses / Indemnity / Total rows: sums of the claim-level rows whose sectionId is this section. */
function sectionSummaryRows(fs, payments, reserves, recoveries) {
  const rowsFor = type => {
    const rs = reserves.filter(r => r.sectionId === fs.sectionId && r.reserveType.startsWith(type) && r.status !== 'Rejected');
    const ps = payments.filter(p => p.sectionId === fs.sectionId && p.sectionType === type);
    const rcs = recoveries.filter(r => r.sectionId === fs.sectionId);
    const outstanding = sum(rs, r => r.reserveValue);
    const completed = sum(ps.filter(p => p.status === 'Done' || p.status === 'Credit'), p => p.amount);
    return {
      movementType: type,
      outstandingReserves: outstanding,
      completedPayments: completed,
      pendingPayments: sum(ps.filter(p => p.status === 'Pending'), p => p.amount),
      recoveries: type === 'Indemnity' ? sum(rcs.filter(r => r.status === 'Approved'), r => r.amount) : 0,
      incurred: outstanding + completed
    };
  };
  const rows = [rowsFor('Expenses'), rowsFor('Indemnity')];
  const total = { movementType: 'Total' };
  for (const k of ['outstandingReserves', 'completedPayments', 'pendingPayments', 'recoveries', 'incurred']) total[k] = sum(rows, r => r[k]);
  return [...rows, total];
}

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

  const scale = scaleOf(claim);

  // Money position. Explicit totals in claim-overview.json win; otherwise an open
  // claim is 35% paid / 65% reserved (movement claims: the reserve IS the movement
  // total and about 20% of it has been paid), a closed claim is fully paid.
  let reserveTotal, paidTotal;
  if (overview) {
    reserveTotal = overview.financialSummary.totalReserve;
    paidTotal = overview.financialSummary.totalPayments;
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

  // payee pool: the client or an external party (the claim's parties, its providers, the policy's
  // broker, a supplier from third-parties.json). Never an internal user.
  const external = n => n && !staff.has(n);
  const partyNames = claimParties
    .filter(p => p.roles.some(r => ['client', 'claimant', 'insured', 'third-party', 'expert'].includes(r)))
    .map(p => p.legalName);
  const suppliers = thirdParties.filter(t => t.relationship === 'supplier');
  const payees = [
    ...new Set(
      [
        claim.clientName,
        ...partyNames,
        ...providerAssignments.filter(p => p.claimId === id).map(p => p.providerName),
        policy?.broker,
        suppliers[hash(id) % suppliers.length]?.name
      ].filter(external)
    )
  ];
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
  } else if (secs.length && overview && !mv.length) {
    // hand-written records (011, 024): reserve split evenly over their open sections
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
      section: openSecs[0] ?? secs[0] ?? null,
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
    const targets = openSecs.length ? openSecs : secs;
    (targets.length ? split(ind, targets.map(() => 1)) : [ind]).forEach((v, i) =>
      mkReserve(v, {
        section: targets[i] ?? null,
        type: 'Indemnity',
        sub: targets[i]?.damageType === 'business-interruption' ? 'Business Interruption' : lob.sub,
        item: lob.item,
        history: [
          { date: histDate(addDays(created, 3)), amount: round(v * 0.75), reason: 'Initial reserve set', user: initialUser },
          { date: histDate(addDays(created, 35)), amount: v, reason: 'Revised after adjuster report', user: initialUser }
        ]
      })
    );
    mkReserve(exp, {
      section: targets[0] ?? null,
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
    a.paymentId = `PMT-${clientCode}-${year}.${claimNo}.1.${seq++}`;
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
    placement.push(secs.length ? (openSecs[0] ?? secs[0]).id : null);
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
  // Section level is a filter on the claim-level rows (by sectionId), not a second copy.
  payments.forEach((p, i) => {
    if (placement[i]) p.sectionId = placement[i];
  });
  recoveries.forEach(r => {
    const sec = finSections.find(x => x.sectionName === r.section);
    if (sec) r.sectionId = sec.sectionId;
  });
  finSections.forEach(fs => {
    fs.payments = [];
    fs.reserves = [];
    fs.recoveries = [];
    fs.summaryRows = sectionSummaryRows(fs, payments, reserves, recoveries);
  });

  // ── totals, details, transactions ───────────────────────────────────────────
  const { summary, details } = summarize(cur, payments, reserves, recoveries);
  const recovered = summary.recoveries;
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
  if (recoveryOverride !== undefined && recovered !== recoveryOverride) {
    throw new Error(`${id}: recoveries ${recovered} != claim-overview ${recoveryOverride}`);
  }
  return {
    claimId: id,
    summary,
    details,
    payments,
    reserves,
    recoveries,
    transactions,
    sections: finSections
  };
}

// ── loss information ──────────────────────────────────────────────────────────
// Edit claim reads Cause of loss / Type of damage from loss-information.json. A claim with
// sections must list their damage types (and a cause that fits), or the Edit screen
// contradicts the Sections page. Hand-written records are never touched.
const SEED_MARK = 'seed-financial-overview';
const CAUSE_KEYS = lookups.causeOfLoss.map(o => o.value);
const CAUSE_ALIASES = { storm: 'natural-event', 'wind-storm': 'natural-event', water: 'natural-event', 'water-damage': 'natural-event' };
const CAUSE_RULES = [
  [/fire|blaze|sprinkler/, 'fire'],
  [/lightning/, 'lightning'],
  [/explosion|blast/, 'explosion'],
  [/arson/, 'arson'],
  [/robbery/, 'robbery'],
  [/burglar|break-in/, 'burglary'],
  [/theft|stolen/, 'theft'],
  [/storm|flood|hail|hurricane|typhoon|wind|water|landslide|snow/, 'natural-event'],
  [/earthquake/, 'earthquake'],
  [/piracy/, 'act-of-piracy'],
  [/defect|breakdown|malfunction|failure|fault|machinery/, 'product-fault'],
  [/collision|negligen|error|omission|injury|liability|third.party/, 'act-of-omission']
];
function causeFor(claim) {
  const own = (claim.causeOfLoss ?? []).map(c => CAUSE_ALIASES[c] ?? c).filter(c => CAUSE_KEYS.includes(c));
  if (own.length) return [...new Set(own)];
  const text = (claim.description ?? '').toLowerCase();
  return [CAUSE_RULES.find(([re]) => re.test(text))?.[1] ?? 'other-event'];
}
function lossInfoFor(claim) {
  const types = [...new Set(sections.filter(x => x.claimId === claim.claimId).map(x => x.damageType))];
  const causes = causeFor(claim);
  const city = claim.location?.city ?? '';
  const country = claim.location?.country ?? '';
  const created = `${isoOf(claim.dateCreated)}T00:00:00Z`;
  return {
    id: `LI-${claim.claimId}`,
    claimId: claim.claimId,
    dateOfLoss: {
      dateOfOccurrence: isoOf(claim.lossDate ?? claim.dateCreated),
      timeOfOccurrence: '09:00',
      dateOfNotification: isoOf(claim.dateCreated),
      timeOfNotification: '10:00'
    },
    lossLocation: {
      locations:
        city || country
          ? [{ id: `loc-${claim.claimId}`, source: 'policy', displayName: [claim.clientName, city].filter(Boolean).join(' — '), addressLine1: '', postalCode: '', city, country }]
          : []
    },
    causeOfLoss: causes,
    typeOfDamage: types,
    circumstance: null,
    lossDescription: claim.description ?? '',
    events: causes.map(c => ({ eventKey: c, damages: types, causedBy: [] })),
    createdAt: created,
    updatedAt: created,
    seedSource: SEED_MARK
  };
}

// ── run ─────────────────────────────────────────────────────────────────────────
const noMoney = c => c.claimId.startsWith('SK-') && ['awaiting-policy', 'abandoned'].includes(c.skeletonState);
const targets = claims.filter(c => c.claimId !== 'CLM-2024-001' && !noMoney(c));
targets.forEach(ensureSections);
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
    lossAmount: o.financialSummary.totalReserve + o.financialSummary.totalPayments,
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
// CLM-2024-001 keeps its rows; only the approval row takes the claim's own id format, and
// summary and details become the sums of those rows (they were hand-typed and didn't add up).
const first = keep[0];
const waiting = first.payments.find(p => /^PMT-C-/.test(p.paymentId));
if (waiting) waiting.paymentId = OWN_PAYMENT_ID_001;
Object.assign(first, summarize(first.details.currency, first.payments, first.reserves, first.recoveries));
// 001's rows get the section they were listed under; the sections' own lists were separate copies.
const sectionOf001 = { 'Section 1: - Property Damage': 'S1', 'Section 2: - Business Interruption': 'S2' };
const paymentSection001 = { '123456-1': 'S1', '123456-2': 'S1', '123456-3': 'S1', '123456-4': 'S2', '123456-5': 'S2', [OWN_PAYMENT_ID_001]: 'S1' };
first.payments.forEach(p => (p.sectionId = paymentSection001[p.paymentId]));
first.recoveries.forEach(r => (r.sectionId = sectionOf001[r.section]));
first.sections.forEach(fs => {
  fs.payments = [];
  fs.recoveries = [];
  fs.summaryRows = sectionSummaryRows(fs, first.payments, first.reserves, first.recoveries);
});

// sections this script made: open ones with reserves / pending payments say so (Close Section reads it)
const fin = new Map(seeded.map(f => [f.claimId, f]));
for (const sec of generatedSections) {
  const f = fin.get(sec.claimId);
  if (sec.status === 'Closed' || !f) continue;
  sec.hasOpenReserves = f.reserves.some(r => r.sectionId === sec.id && r.status !== 'Rejected' && r.reserveValue > 0);
  sec.hasOpenPayments = f.payments.some(p => p.sectionId === sec.id && p.status === 'Pending');
}

const out = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
out(outPath, [...keep, ...seeded]);
out(resolve(root, 'src/app/core/mock/data/sections.json'), [...sections]);
out(resolve(root, 'src/app/core/mock/data/payment-approvals.json'), payAppr);
const handWritten = lossInfo.filter(r => r.seedSource !== SEED_MARK);
const needLossInfo = targets.filter(
  c => sections.some(x => x.claimId === c.claimId) && !handWritten.some(r => r.claimId === c.claimId)
);
out(lossInfoPath, [...handWritten, ...needLossInfo.map(lossInfoFor)]);
console.log(`Loss information for ${needLossInfo.length} claims. Seeded ${seeded.length} claims (${generatedSections.length} new sections): ${seeded.map(f => f.claimId).join(', ')}`);
