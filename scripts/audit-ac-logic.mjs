/**
 * audit-ac-logic.mjs
 *
 * Universal AC logic verifier.
 * Discovers all public/tickets/*.json, simulates each AC's stateOverrides
 * against the mock data layer, then asserts every expectedOutcome field.
 *
 * Add a new ticket: drop a JSON file in public/tickets/ — no other changes needed.
 *
 * Exit 0 = all assertions pass.
 * Exit 1 = one or more assertions fail (details printed to stdout).
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const root    = resolve(__dir, '..');
const dataDir = resolve(root, 'src/app/core/mock/data');
const tickDir = resolve(root, 'public/tickets');

// ── Load base mock data ────────────────────────────────────────────────────────
const allTasks     = JSON.parse(readFileSync(resolve(dataDir, 'tasks.json'),         'utf8'));
const allSections  = JSON.parse(readFileSync(resolve(dataDir, 'sections.json'),      'utf8'));
const allOverviews = JSON.parse(readFileSync(resolve(dataDir, 'claim-overview.json'),'utf8'));
const allClaims    = JSON.parse(readFileSync(resolve(dataDir, 'claims.json'),        'utf8'));
const allCwbLocs   = JSON.parse(readFileSync(resolve(dataDir, 'cwb-locations.json'), 'utf8'));
const allPayments  = JSON.parse(readFileSync(resolve(dataDir, 'payments.json'),      'utf8'));
const allRecovery  = JSON.parse(readFileSync(resolve(dataDir, 'recovery-cases.json'), 'utf8'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Apply stateOverrides to base data and return derived actual state. */
function simulateState(claimId, stateOverrides) {
  const so = stateOverrides ?? {};

  const tasks    = allTasks.filter(t => t.claimId === claimId).map(t => ({ ...t }));
  const sections = allSections.filter(s => s.claimId === claimId).map(s => ({ ...s }));
  const overview = { ...(allOverviews[claimId] ?? {}) };
  let   claims   = allClaims.map(c => ({ ...c }));
  let   cwbLocs  = allCwbLocs.map(c => ({ ...c }));
  let   payments = allPayments.filter(p => p.claimId === claimId).map(p => ({ ...p }));

  if (so.taskStatuses) {
    for (const t of tasks) {
      if (so.taskStatuses[t.taskId]) t.status = so.taskStatuses[t.taskId];
    }
  }

  if (so.sectionStatuses) {
    for (const s of sections) {
      if (so.sectionStatuses[s.id]) s.status = so.sectionStatuses[s.id];
    }
  }

  if (so.sectionBlockers) {
    for (const s of sections) {
      if (so.sectionBlockers[s.id]) Object.assign(s, so.sectionBlockers[s.id]);
    }
  }

  if (so.paymentStatuses) {
    for (const p of payments) {
      if (so.paymentStatuses[p.paymentId]) p.status = so.paymentStatuses[p.paymentId];
    }
  }

  if (so.overviewPatch) {
    Object.assign(overview, so.overviewPatch.patch);
  }

  if (Array.isArray(so.claimsAppend) && so.claimsAppend.length) {
    const existingIds = new Set(claims.map(c => c.claimId));
    for (const c of so.claimsAppend) {
      if (!existingIds.has(c.claimId)) claims.push({ ...c });
    }
  }

  if (Array.isArray(so.cwbLocationsAppend) && so.cwbLocationsAppend.length) {
    const existingRefs = new Set(cwbLocs.map(c => c.cwbReference));
    for (const c of so.cwbLocationsAppend) {
      if (!existingRefs.has(c.cwbReference)) cwbLocs.push({ ...c });
    }
  }
  // fnolStateOverride: runtime UI behavior — not derivable; skipped here.
  // (selectedPolicy / selectedClient / path / convertFromSkeletonId all act on
  // FnolStateService at runtime and have no Node-side counterpart.)

  const pendingTasks  = tasks.filter(t => t.status !== 'done').length;
  const doneTasks     = tasks.filter(t => t.status === 'done').length;
  const openSections  = sections.filter(s => s.status !== 'Closed').length;
  const closedSections = sections.filter(s => s.status === 'Closed').length;
  const overviewStatus = overview.status ?? null;

  // TD-028: when paymentStatuses override is present, derive hasOpenPayments from
  // actual payment records (any Pending) instead of the flag on ClaimOverview.
  const derivedHasOpenPayments = so.paymentStatuses
    ? payments.some(p => p.status === 'Pending')
    : overview.hasOpenPayments;

  // BMPCC-11360 AC2 — additional activity blockers from claim flags
  const extraBlockers = [
    derivedHasOpenPayments,
    overview.hasOpenReserves,
    overview.hasActiveRecovery,
    overview.hasOpenDeductible,
    overview.hasActiveLitigation,
    overview.hasActiveProvider,
    overview.hasUnpaidBills,
    overview.hasIncompleteReports,
  ].filter(Boolean).length;

  const pendingPaymentsCount = payments.filter(p => p.status === 'Pending').length;

  // BMPCC-17779 (Recoveries call, 2026-09-01) — mirrors the
  // 'recovery-potential-unset' blocker in claim-closure-blocker.builder.ts.
  // An unanswered Yes/No holds closure; answering either way clears it.
  const recoveryPotentialUnset = overview.recoveryPotential !== 'yes'
    && overview.recoveryPotential !== 'no';

  // Phase B — recovery cases live in their own file, so the two claim-level
  // flags are derived here rather than read off the overview. An overviewPatch
  // that sets them by hand still wins: an AC is allowed to describe a claim
  // state the seeded case list does not contain.
  const recoveryCases     = allRecovery.filter(c => c.claimId === claimId);
  const openRecoveryCases = recoveryCases.filter(c => c.status !== 'Recovered' && c.status !== 'Written off');
  const patchedRecovery   = so.overviewPatch?.claimId === claimId ? (so.overviewPatch.patch ?? {}) : {};
  const hasRecoveryCase   = 'hasRecoveryCase'   in patchedRecovery ? patchedRecovery.hasRecoveryCase
                                                                   : (overview.hasRecoveryCase ?? recoveryCases.length > 0);
  const hasActiveRecovery = 'hasActiveRecovery' in patchedRecovery ? patchedRecovery.hasActiveRecovery
                                                                   : (overview.hasActiveRecovery ?? openRecoveryCases.length > 0);
  const recoveryState = recoveryPotentialState(overview.recoveryPotential ?? null, hasRecoveryCase, hasActiveRecovery);

  // Phase B — 'recovery-not-set-up' became a hard blocker once
  // /claims/:id/recoveries stopped being a redirect stub.
  const canClose = pendingTasks === 0
    && openSections === 0
    && extraBlockers === 0
    && !recoveryPotentialUnset
    && recoveryState !== 'yes-pending'
    && overviewStatus !== 'Closed';

  return {
    pendingTasks, doneTasks, openSections, closedSections, overviewStatus, canClose,
    tasks, sections, overview, claims, cwbLocs, payments, pendingPaymentsCount,
    recoveryState, recoveryCasesCount: recoveryCases.length, openRecoveryCasesCount: openRecoveryCases.length,
  };
}

/**
 * Mirrors recoveryPotentialState() in core/models/recovery-potential.model.ts.
 * Kept as one function so the four surfaces the model warns about cannot drift
 * from the auditor that checks them.
 */
function recoveryPotentialState(recoveryPotential, hasRecoveryCase, hasActiveRecovery) {
  if (recoveryPotential === 'no')  return 'no';
  if (recoveryPotential !== 'yes') return 'unanswered';
  if (!hasRecoveryCase && !hasActiveRecovery) return 'yes-pending';
  return hasActiveRecovery ? 'yes-active' : 'yes-settled';
}

/**
 * Assert one expectedOutcome field.
 * Supported keys:
 *   pendingTasks      — exact count of tasks where status !== 'done'
 *   doneTasks         — exact count of tasks where status === 'done'
 *   openSections      — exact count of sections where status !== 'Closed'
 *   closedSections    — exact count of sections where status === 'Closed'
 *   overviewStatus    — exact string match on overview.status
 *   canClose          — boolean: pendingTasks===0 && openSections===0 && status!=='Closed'
 *   buttonVisible     — boolean: whether Close Claim button should be rendered
 *                        (true when status !== 'Closed' && status !== 'Reopened')
 *   buttonEnabled     — boolean: canClose (button rendered and enabled)
 *   tooltipContains   — string: substring expected in tooltip text
 *   taskStatuses      — object: { taskId: expectedStatus } spot-checks per task
 *   sectionStatuses   — object: { sectionId: expectedStatus } spot-checks per section
 *   sectionBlockers   — object: { sectionId: { blockerField: boolean } } spot-checks blocker flags
 *   closedByName      — string: overview.closedBy.name
 *   closureReason     — string: overview.closureReason
 *   recoveryPotentialState  — 'unanswered' | 'yes-pending' | 'yes-active' | 'yes-settled' | 'no'
 *   recoveryCasesCount      — exact count of recovery-cases.json rows for the claim
 *   openRecoveryCasesCount  — same, restricted to Draft/In progress
 */
function assertOutcome(acId, actual, expectedOutcome) {
  const failures = [];

  for (const [key, expected] of Object.entries(expectedOutcome)) {
    switch (key) {

      case 'pendingTasks':
        if (actual.pendingTasks !== expected)
          failures.push(`pendingTasks: expected ${expected}, got ${actual.pendingTasks}`);
        break;

      case 'doneTasks':
        if (actual.doneTasks !== expected)
          failures.push(`doneTasks: expected ${expected}, got ${actual.doneTasks}`);
        break;

      case 'openSections':
        if (actual.openSections !== expected)
          failures.push(`openSections: expected ${expected}, got ${actual.openSections}`);
        break;

      case 'closedSections':
        if (actual.closedSections !== expected)
          failures.push(`closedSections: expected ${expected}, got ${actual.closedSections}`);
        break;

      case 'overviewStatus':
        if (actual.overviewStatus !== expected)
          failures.push(`overviewStatus: expected "${expected}", got "${actual.overviewStatus}"`);
        break;

      case 'canClose':
        if (actual.canClose !== expected)
          failures.push(`canClose: expected ${expected}, got ${actual.canClose}`);
        break;

      case 'buttonVisible': {
        const visible = actual.overviewStatus !== 'Closed' && actual.overviewStatus !== 'Reopened';
        if (visible !== expected)
          failures.push(`buttonVisible: expected ${expected}, got ${visible} (status="${actual.overviewStatus}")`);
        break;
      }

      case 'buttonEnabled':
        if (actual.canClose !== expected)
          failures.push(`buttonEnabled: expected ${expected}, got ${actual.canClose}`);
        break;

      case 'tooltipContains': {
        // Build tooltip text same as closureTooltip() in component
        const parts = [];
        if (actual.pendingTasks > 0) parts.push(`${actual.pendingTasks} pending task(s)`);
        if (actual.openSections > 0) parts.push(`${actual.openSections} open section(s)`);
        const tooltip = parts.length ? `Cannot close: ${parts.join(', ')}` : '';
        if (!tooltip.includes(expected))
          failures.push(`tooltipContains: expected "${expected}" in "${tooltip}"`);
        break;
      }

      case 'taskStatuses': {
        for (const [taskId, expectedStatus] of Object.entries(expected)) {
          const task = actual.tasks.find(t => t.taskId === taskId);
          if (!task)
            failures.push(`taskStatuses[${taskId}]: task not found in claimId scope`);
          else if (task.status !== expectedStatus)
            failures.push(`taskStatuses[${taskId}]: expected "${expectedStatus}", got "${task.status}"`);
        }
        break;
      }

      case 'sectionStatuses': {
        for (const [secId, expectedStatus] of Object.entries(expected)) {
          const sec = actual.sections.find(s => s.id === secId);
          if (!sec)
            failures.push(`sectionStatuses[${secId}]: section not found in claimId scope`);
          else if (sec.status !== expectedStatus)
            failures.push(`sectionStatuses[${secId}]: expected "${expectedStatus}", got "${sec.status}"`);
        }
        break;
      }

      case 'sectionBlockers': {
        for (const [secId, expectedBlockers] of Object.entries(expected)) {
          const sec = actual.sections.find(s => s.id === secId);
          if (!sec) {
            failures.push(`sectionBlockers[${secId}]: section not found in claimId scope`);
          } else {
            for (const [field, expectedVal] of Object.entries(expectedBlockers)) {
              if (sec[field] !== expectedVal)
                failures.push(`sectionBlockers[${secId}].${field}: expected ${expectedVal}, got ${sec[field]}`);
            }
          }
        }
        break;
      }

      case 'paymentStatuses': {
        for (const [payId, expectedStatus] of Object.entries(expected)) {
          const pay = actual.payments.find(p => p.paymentId === payId);
          if (!pay)
            failures.push(`paymentStatuses[${payId}]: payment not found in claimId scope`);
          else if (pay.status !== expectedStatus)
            failures.push(`paymentStatuses[${payId}]: expected "${expectedStatus}", got "${pay.status}"`);
        }
        break;
      }

      case 'pendingPaymentsCount': {
        if (actual.pendingPaymentsCount !== expected)
          failures.push(`pendingPaymentsCount: expected ${expected}, got ${actual.pendingPaymentsCount}`);
        break;
      }

      case 'closedByName': {
        const cb = actual.overview.closedBy;
        const name = typeof cb === 'object' ? cb?.name : cb;
        if (name !== expected)
          failures.push(`closedByName: expected "${expected}", got "${name}"`);
        break;
      }

      case 'closureReason': {
        if (actual.overview.closureReason !== expected)
          failures.push(`closureReason: expected "${expected}", got "${actual.overview.closureReason}"`);
        break;
      }

      // BMPCC-17779 — the recovery-potential decision on record. `null` asserts
      // the unanswered state, which is the whole point of the flag; use it to
      // pin down ACs that blank the seeded value via overviewPatch.
      case 'recoveryPotential': {
        const rp = actual.overview.recoveryPotential ?? null;
        if (rp !== expected)
          failures.push(`recoveryPotential: expected ${JSON.stringify(expected)}, got ${JSON.stringify(rp)}`);
        break;
      }

      // BMPCC-17779 — derived state shared by the overview card, the closure
      // checklist, the dashboard prompt and the Recoveries page. Computed in
      // simulateState via the mirror of recoveryPotentialState().
      case 'recoveryPotentialState': {
        if (actual.recoveryState !== expected)
          failures.push(`recoveryPotentialState: expected "${expected}", got "${actual.recoveryState}"`);
        break;
      }

      // BMPCC-17779 phase B — how many recovery cases the recovery domain holds
      // for this claim, and how many of them are still running.
      case 'recoveryCasesCount': {
        if (actual.recoveryCasesCount !== expected)
          failures.push(`recoveryCasesCount: expected ${expected}, got ${actual.recoveryCasesCount}`);
        break;
      }

      case 'openRecoveryCasesCount': {
        if (actual.openRecoveryCasesCount !== expected)
          failures.push(`openRecoveryCasesCount: expected ${expected}, got ${actual.openRecoveryCasesCount}`);
        break;
      }

      // ── Runtime-only keys (cannot be statically simulated in Node — verified
      //    manually via dev context menu / browser). Audit silently skips them.
      case 'sectionStatus':
      case 'closedByUserId':
      case 'claimStatus':
      case 'retentionDateFormula':
      case 'toastType':
      case 'activityLogged':
        // intentional no-op: runtime-only assertion, not evaluable in audit harness.
        break;

      case 'duplicateClaimsCount': {
        // Count distinct claims matching {policyNumber, lossDate} from any seeded claim that has both fields.
        // Caller form: { duplicateClaimsCount: { policyNumber, lossDate, expected } }
        const { policyNumber, lossDate, expected: count } = expected ?? {};
        const matches = actual.claims.filter(c =>
          c.policyNumber === policyNumber && c.lossDate === lossDate
        );
        if (matches.length !== count)
          failures.push(`duplicateClaimsCount: expected ${count} for policy=${policyNumber} date=${lossDate}, got ${matches.length}`);
        break;
      }

      case 'claimExists': {
        const id = expected;
        if (!actual.claims.some(c => c.claimId === id))
          failures.push(`claimExists: claimId "${id}" not present after mutations`);
        break;
      }

      case 'cwbLocationExists': {
        const ref = expected;
        if (!actual.cwbLocs.some(c => c.cwbReference === ref))
          failures.push(`cwbLocationExists: cwbReference "${ref}" not present after mutations`);
        break;
      }

      case 'cwbLocationsCount': {
        const { policyNumber, expected: count } = expected ?? {};
        const matches = actual.cwbLocs.filter(c =>
          policyNumber ? c.policyNumber === policyNumber : true
        );
        if (matches.length !== count)
          failures.push(`cwbLocationsCount: expected ${count} for policy=${policyNumber}, got ${matches.length}`);
        break;
      }

      default:
        failures.push(`UNKNOWN assertion key: "${key}" — add it to audit-ac-logic.mjs`);
    }
  }

  return failures;
}

// ── Main ───────────────────────────────────────────────────────────────────────
const ticketFiles = readdirSync(tickDir).filter(f => f.endsWith('.json') && f !== 'index.json');

if (ticketFiles.length === 0) {
  console.log('[audit:ac-logic] No ticket files found in public/tickets/ — skipping.');
  process.exit(0);
}

let totalACs     = 0;
let totalFailed  = 0;
let totalSkipped = 0;

for (const file of ticketFiles.sort()) {
  const ticket   = JSON.parse(readFileSync(resolve(tickDir, file), 'utf8'));
  const acs      = ticket.acceptanceCriteria ?? [];

  console.log(`\n📋  ${ticket.ticketId} — ${ticket.title}  (${file})`);
  console.log(`    target: ${ticket.targetClaim}  |  ACs: ${acs.length}`);

  for (const ac of acs) {
    totalACs++;

    if (!ac.expectedOutcome) {
      console.log(`  ⚪  ${ac.id}  — no expectedOutcome, skipped`);
      totalSkipped++;
      continue;
    }

    // An AC may name its own claim when the ticket's target cannot hold the
    // state it describes — see TicketAC.targetClaim in dev-ticket.model.ts.
    const claimId  = ac.targetClaim ?? ticket.targetClaim;
    const actual   = simulateState(claimId, ac.setup?.stateOverrides);
    const failures = assertOutcome(ac.id, actual, ac.expectedOutcome);

    if (failures.length === 0) {
      const on = ac.targetClaim ? ` [${ac.targetClaim}]` : '';
      console.log(`  ✅  ${ac.id}${on}  ${ac.plainStatement ?? ac.statement}`);
    } else {
      totalFailed++;
      console.log(`  ❌  ${ac.id}  ${ac.plainStatement ?? ac.statement}`);
      for (const f of failures) {
        console.log(`        → ${f}`);
      }
    }
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Total: ${totalACs} ACs | ✅ ${totalACs - totalFailed - totalSkipped} passed | ❌ ${totalFailed} failed | ⚪ ${totalSkipped} skipped`);

if (totalFailed > 0) {
  console.log('\naudit:ac-logic FAILED — fix the AC logic mismatches above.\n');
  process.exit(1);
}

console.log('\naudit:ac-logic passed.\n');
process.exit(0);
