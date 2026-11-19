// Global Genius: section-level booking outcome on Claim Overview (BMPCC-22661,
// epic BMPCC-22267). The Finance domain publishes a booking outcome event for
// every GG answer; for a section event that failed, the outcome carries GG's
// failure message. The claim-level outcome is ClaimOverview.ggRegistration +
// ggFailureMessage (gg-claim-registration.model.ts).
//
// DESIGN DECISION GG-SEC-1: same retry rules as the claim event (GG-2), so the
// two never behave differently on one page:
// - "Retry" re-publishes the SAME section event; it moves no money, so
//   there is no confirm dialog (as the claim retry). Feedback: the row turns to
//   "Retrying", then a toast + a bell line say how it went.
// - one handler retry that fails again leaves one more try; after the second
//   failed retry the row says Finance has it and the button goes (a button the
//   handler is told not to press gets pressed, review round 2).
// - section events only go to GG once the claim itself is set up there, so the
//   section list is hidden while the claim banner (failed / still being set up)
//   is showing. Fix the claim first; the sections follow.

export type GgSectionBookingStatus = 'failed' | 'retrying' | 'booked';

export interface GgSectionBooking {
  sectionId: string;
  status: GgSectionBookingStatus;
  // Failure message from the booking outcome event, shown as GG wrote it.
  failureMessage?: string;
  // Handler retries that failed again (0 = only the original send failed).
  retryFailures?: number;
  // PROTOTYPE ONLY: what Retry does in the mock, so the DEV banner can show both.
  demoResendOutcome?: 'booked' | 'fails-again';
}

/** Retries allowed before Finance owns the fix (same as the claim event). */
export const SECTION_MAX_RETRIES = 2;

export function sectionCanRetry(b: GgSectionBooking): boolean {
  return b.status === 'failed' && (b.retryFailures ?? 0) < SECTION_MAX_RETRIES;
}

export function sectionWithFinance(b: GgSectionBooking): boolean {
  return b.status === 'failed' && (b.retryFailures ?? 0) >= SECTION_MAX_RETRIES;
}

/** Short line under the section name: what happened and what to do. */
export function sectionBookingHint(b: GgSectionBooking): string {
  if (b.status === 'retrying') return 'Retrying: waiting for Global Genius. This usually takes a few seconds.';
  if (sectionWithFinance(b)) return "Retried twice, still not booked. The Finance team is fixing it: we'll let you know.";
  if ((b.retryFailures ?? 0) === 1) return 'Retried, still not booked. You can retry once more, or wait for Finance.';
  return 'You can retry now. Finance have been told.';
}
