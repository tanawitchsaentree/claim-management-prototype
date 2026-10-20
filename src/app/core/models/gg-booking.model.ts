// Global Genius (GG) booking — BMPCC-18348 (epic), FE stories BMPCC-19168 /
// 19169 / 19170 (reserve / payment / recovery status + error on UI), claim
// level BMPCC-20232. GG is the sub-ledger: a claim must exist in GG before any
// money on it can be booked, and each reserve / payment / recovery is sent
// separately, after approval (epic AC2), and answered asynchronously.
//
// DESIGN DECISION GG-1: no Retry button at either level. Transient failures
// are retried by the system (handover outbox 3x + BMPCC-18136 scheduler);
// permanent ones don't clear on resend, and a manual resend while the first
// is still in flight risks booking the money twice. A permanent failure is
// routed to whoever can fix it (a task for the handler, or Finance).

/** Is the claim itself registered in GG? Absent = registered (pre-GG data). */
export type GgClaimRegistration = 'registered' | 'registering' | 'failed' | 'policy-missing';

/** Booking state of one approved reserve / payment / recovery. */
export type BookingStatus = 'booking' | 'waiting-claim' | 'delayed' | 'booked' | 'needs-fixing';

/** Who has to act on a permanent booking failure. */
export type BookingFixOwner = 'handler' | 'finance';

export interface BookingIssue {
  // Plain-language reason, never GG's raw error-message (that stays with support).
  reason: string;
  owner: BookingFixOwner;
  // Task created for the handler when owner === 'handler'.
  taskId?: string;
}

/** Fields a reserve / payment / recovery row carries once it is approved. */
export interface Bookable {
  bookingStatus?: BookingStatus;
  bookingIssue?: BookingIssue;
}

/**
 * What the row's single status column says to the handler. One column, not
 * two: the handler asks "where is my money", not "what did approval say and
 * what did GG say". Approval states pass through; once approved, the booking
 * state takes over. `tone` groups by what the handler has to do.
 */
export type StatusTone = 'action' | 'waiting' | 'done';

export interface DisplayStatus {
  label: string;
  tone: StatusTone;
}

const BOOKING_DISPLAY: Record<BookingStatus, DisplayStatus> = {
  booking: { label: 'Booking in progress', tone: 'waiting' },
  'waiting-claim': { label: 'Waiting for claim', tone: 'waiting' },
  delayed: { label: 'Booking delayed', tone: 'waiting' },
  booked: { label: 'Booked', tone: 'done' },
  'needs-fixing': { label: 'Needs fixing', tone: 'action' }
};

const APPROVAL_TONE: Record<string, StatusTone> = {
  Draft: 'action',
  'Requires amendment': 'action',
  Pending: 'waiting',
  Rejected: 'done',
  Approved: 'done',
  Done: 'done',
  Credit: 'done'
};

/** Approval statuses after which the item belongs to GG. */
const HANDED_TO_GG = new Set(['Approved', 'Done', 'Credit']);

export function displayStatus(approvalStatus: string, booking?: BookingStatus): DisplayStatus {
  if (booking && HANDED_TO_GG.has(approvalStatus)) return BOOKING_DISPLAY[booking];
  return { label: approvalStatus, tone: APPROVAL_TONE[approvalStatus] ?? 'waiting' };
}

/** Claim-level message, shown only when something is wrong. */
export interface ClaimRegistrationMessage {
  title: string;
  body: string;
  severity: 'error' | 'info';
}

export function claimRegistrationMessage(
  state: GgClaimRegistration | undefined
): ClaimRegistrationMessage | null {
  switch (state) {
    case 'failed':
      return {
        title: 'Payments and reserves are on hold',
        body: "This claim couldn't be set up in Global Genius, so nothing on it can be booked yet. The Finance team has been told and is fixing it. You don't need to do anything.",
        severity: 'error'
      };
    case 'policy-missing':
      return {
        title: 'Payments and reserves are on hold',
        body: "This claim's policy isn't in Global Genius yet, so nothing on it can be booked. The policy team needs to add it. You don't need to do anything.",
        severity: 'error'
      };
    case 'registering':
      return {
        title: 'Claim is still being set up',
        body: 'Global Genius is still setting up this claim. You can carry on: anything you submit now is queued and booked once the claim is ready.',
        severity: 'info'
      };
    default:
      return null;
  }
}
