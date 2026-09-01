import { ClaimOverview } from '../models/claim-overview.model';
import { Task } from '../models/task.model';
import { Litigation } from '../models/litigation.model';
import { ReservesPolicyData } from '../models/reserve.model';
import { ClaimPayment } from '../models/payment.model';
import { ProviderAssignment } from '../models/provider-assignment.model';
import { BlockerCheckResult, Blocker } from '../models/claim-closure.model';
import { recoveryPotentialState } from '../models/recovery-potential.model';

export function buildBlockerResult(
  claim: ClaimOverview,
  tasks: Task[],
  openSections: number,
  activeLit: Litigation[],
  reservesData: ReservesPolicyData | null,
  pendingPayments: ClaimPayment[],
  activeProviders: ProviderAssignment[],
): BlockerCheckResult {
  const blockers: Blocker[] = [];

  const pending = tasks.filter(t => t.status !== 'done');
  if (pending.length > 0) {
    blockers.push({
      type: 'tasks',
      label: `${pending.length} pending task(s) must be resolved before closure`,
      count: pending.length,
    });
  }

  if (openSections > 0) {
    blockers.push({
      type: 'sections',
      label: `${openSections} open section(s) must be closed before claim closure`,
      count: openSections,
    });
  }

  // BMPCC-14435 — Litigation: deep check via MockLitigationService.
  // Falls back to boolean flag only if no policyNumber/claimId lookup was possible.
  if (activeLit.length > 0) {
    blockers.push({
      type:      'litigation',
      label:     `${activeLit.length} active litigation case(s) must be resolved`,
      count:     activeLit.length,
      link:      `/claims/${claim.claimId}/litigation`,
      linkLabel: 'Go to Litigation',
    });
  } else if (claim.hasActiveLitigation) {
    blockers.push({
      type: 'litigation',
      label: 'Open litigation must be resolved',
      link: `/claims/${claim.claimId}/litigation`,
      linkLabel: 'Go to Litigation',
    });
  }

  // BMPCC-14435 — Reserves: deep check via MockReservesService.
  // Falls back to boolean flag if policy data unavailable.
  const openReserves = reservesData?.reserves.filter(r => (r.amount ?? 0) > 0) ?? [];
  if (openReserves.length > 0) {
    const total = openReserves.reduce((sum, r) => sum + (r.amount ?? 0), 0);
    blockers.push({
      type:   'reserves',
      label:  `${openReserves.length} open reserve line(s) must be released — €${total.toLocaleString()}`,
      count:  openReserves.length,
      amount: total,
    });
  } else if (claim.hasOpenReserves) {
    blockers.push({ type: 'reserves', label: 'Open reserves must be closed or released' });
  }

  // BMPCC-14435 — Payments: deep check via MockPaymentsService.
  // Falls back to boolean flag when service returns empty.
  if (pendingPayments.length > 0) {
    const total = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    blockers.push({
      type:   'payments',
      label:  `${pendingPayments.length} pending payment(s) totalling €${total.toLocaleString()} must be settled`,
      count:  pendingPayments.length,
      amount: total,
    });
  } else if (claim.hasOpenPayments) {
    blockers.push({ type: 'payments', label: 'Outstanding payments must be settled' });
  }

  // BMPCC-14435 — Provider: deep check via MockProviderService.
  // Falls back to boolean flag when service returns empty.
  if (activeProviders.length > 0) {
    blockers.push({
      type:      'provider',
      label:     `${activeProviders.length} active provider assignment(s) must be finalised`,
      count:     activeProviders.length,
      link:      `/claims/${claim.claimId}/providers`,
      linkLabel: 'Go to Provider Management',
    });
  } else if (claim.hasActiveProvider) {
    blockers.push({
      type: 'provider',
      label: 'Provider instructions must be finalised',
      link: `/claims/${claim.claimId}/providers`,
      linkLabel: 'Go to Provider Management',
    });
  }

  // BMPCC-17779 (Recoveries call, 2026-09-01) — "what is most crucial: that
  // they make any selection minimum, yes or no". Before this, a claim could be
  // closed with the question never answered, and recoverable money went with
  // it. Answering "No" clears the blocker; the pressure is meant to come off.
  if (recoveryPotentialState(claim) === 'unanswered') {
    blockers.push({
      type:      'recovery-potential-unset',
      label:     'Recovery potential has not been answered (Yes/No)',
      link:      `/claims/${claim.claimId}/overview`,
      linkLabel: 'Answer on Claim Overview',
    });
  }

  if (claim.hasActiveRecovery) {
    blockers.push({ type: 'recovery',   label: 'Active recovery actions must be resolved' });
  }
  if (claim.hasOpenDeductible) {
    blockers.push({ type: 'deductible', label: 'Deductible collections must be confirmed' });
  }
  if (claim.hasUnpaidBills) {
    blockers.push({ type: 'bills',      label: 'Unpaid bills must be cleared' });
  }
  if (claim.hasIncompleteReports) {
    blockers.push({ type: 'reports',    label: 'Required reports must be submitted' });
  }

  return { canClose: blockers.length === 0, blockers };
}
