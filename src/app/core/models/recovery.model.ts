/**
 * The recovery domain — where a "Yes" on the claim's recovery-potential
 * question actually becomes work.
 *
 * BMPCC-17779 phase B (Recoveries call, 2026-09-01). Phase A made the Yes/No
 * question impossible to skip and pointed the handler here; until now the
 * pointer landed on a redirect stub, so "Yes" still ended nowhere. A recovery
 * case is the thing that closes that loop, and it is the thing the closure
 * checklist can honestly ask for.
 *
 * Deliberately NOT the same as the `recoveries` rows in
 * `financial-overview.json`: those are *bookings* (money already moved,
 * reinsurance/deductible ledger lines). A RecoveryCase is the pursuit — who we
 * are chasing, on what basis, for how much, and whether it is still running.
 */

/** Draft/In progress still need a handler. Recovered/Written off are terminal. */
export type RecoveryCaseStatus = 'Draft' | 'In progress' | 'Recovered' | 'Written off';

/** The legal/commercial basis for the pursuit. */
export type RecoveryRoute =
  | 'Subrogation'
  | 'Salvage'
  | 'Third-party liability'
  | 'Reinsurance'
  | 'Deductible collection';

export interface RecoveryCase {
  id:               string;
  claimId:          string;
  route:            RecoveryRoute;
  /** Who the money is being pursued from. */
  counterparty:     string;
  /** Free reference to the section/entity the loss sits on, when known. */
  sectionRef?:      string;
  currency:         string;
  estimatedAmount:  number;
  /** 0 until the case is resolved as Recovered. */
  recoveredAmount:  number;
  status:           RecoveryCaseStatus;
  /** ISO yyyy-MM-dd — display through AppDatePipe, never raw. */
  openedDate:       string;
  expectedDate?:    string;
  resolvedDate?:    string;
  owner:            string;
  note?:            string;
  /** Why it was written off, or how the recovered sum was settled. */
  outcomeNote?:     string;
}

export interface RecoveryCaseFilters {
  claimId?: string;
  status?:  RecoveryCaseStatus;
}

/** What the create modal hands back — the service owns id/dates/status. */
export interface NewRecoveryCase {
  route:           RecoveryRoute;
  counterparty:    string;
  sectionRef?:     string;
  estimatedAmount: number;
  expectedDate?:   string;
  note?:           string;
}

export interface RecoveryResolution {
  status:          Extract<RecoveryCaseStatus, 'Recovered' | 'Written off'>;
  recoveredAmount: number;
  outcomeNote:     string;
}

export const RECOVERY_ROUTES: readonly RecoveryRoute[] = [
  'Subrogation',
  'Salvage',
  'Third-party liability',
  'Reinsurance',
  'Deductible collection',
] as const;

const TERMINAL: readonly RecoveryCaseStatus[] = ['Recovered', 'Written off'];

/** Open = still holding the claim open. Drives `hasActiveRecovery`. */
export function isRecoveryOpen(c: RecoveryCase): boolean {
  return !TERMINAL.includes(c.status);
}

/**
 * The two claim-level flags the Overview card and the closure checklist read.
 *
 * Both are derived from the case list rather than set by hand, because
 * "a case exists" and "a case is still running" are different questions and
 * hand-maintaining two booleans across create/resolve is how they drift apart.
 */
export interface RecoveryRollup {
  hasRecoveryCase:   boolean;
  hasActiveRecovery: boolean;
}

export function rollupRecoveries(cases: readonly RecoveryCase[]): RecoveryRollup {
  return {
    hasRecoveryCase:   cases.length > 0,
    hasActiveRecovery: cases.some(isRecoveryOpen),
  };
}
