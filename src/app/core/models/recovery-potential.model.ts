import { ClaimOverview } from './claim-overview.model';

/**
 * Derived lifecycle of the recovery-potential decision on a claim.
 *
 * The two raw fields (`recoveryPotential` + `hasActiveRecovery`) allow
 * combinations that mean very different things to a handler, and three
 * surfaces now act on them — the Claim Overview card, the closure checklist,
 * and the dashboard prompt. They read this instead of each re-deriving the
 * combinations, because the Recoveries call feedback (2026-09-01) is
 * specifically about the *unanswered* case, and three hand-rolled
 * `=== 'yes' && !hasActiveRecovery` checks is how one of them silently stops
 * agreeing with the other two.
 */
export type RecoveryPotentialState =
  /** No Yes/No on record. The case the Recoveries call was called about. */
  | 'unanswered'
  /** Yes, but no recovery case exists yet in the recovery domain. */
  | 'yes-pending'
  /** Yes, and a recovery case is running. */
  | 'yes-active'
  /** No — a rationale is on record and nothing further is expected. */
  | 'no';

/** The subset of ClaimOverview the derivation actually reads. */
export type RecoveryPotentialSource = Pick<ClaimOverview, 'recoveryPotential' | 'hasActiveRecovery'>;

export function recoveryPotentialState(claim: RecoveryPotentialSource): RecoveryPotentialState {
  if (claim.recoveryPotential === 'no') return 'no';
  if (claim.recoveryPotential === 'yes') return claim.hasActiveRecovery ? 'yes-active' : 'yes-pending';
  return 'unanswered';
}

/** States that must be resolved before a claim can be closed. */
export function blocksClosure(state: RecoveryPotentialState): boolean {
  return state === 'unanswered' || state === 'yes-pending';
}

export const RECOVERY_STATE_MESSAGE: Record<RecoveryPotentialState, string> = {
  'unanswered':  'A Yes/No recovery decision is required before this claim can be closed.',
  'yes-pending': 'Recovery is expected but no recovery case has been set up yet.',
  'yes-active':  'A recovery case is active for this claim.',
  'no':          'No recovery expected.',
};

/**
 * One claim needing a handler's attention on the dashboard. Only the two
 * actionable states appear here — 'yes-active' and 'no' are settled.
 */
export interface RecoveryAttentionItem {
  claimId: string;
  clientName: string;
  state: 'unanswered' | 'yes-pending';
  reason: string;
}
