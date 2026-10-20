// Global Genius (GG) booking — BMPCC-18348 (epic), FE stories BMPCC-19168 /
// 19169 / 19170 (reserve / payment / recovery status + error on UI), claim
// level BMPCC-20232. GG is the sub-ledger: a claim must exist in GG before any
// money on it can be booked, and each reserve / payment / recovery is sent
// separately, after approval (epic AC2), and answered asynchronously.
//
// DESIGN DECISION GG-2 (replaces GG-1 "no Retry", per PO 2026-10-20): handlers
// can send a FAILED item (or a failed claim set-up) to GG again. Guardrails,
// from the handler usability review:
// - only on 'needs-fixing', never on 'booking' / 'delayed' (a resend while the
//   first is still in flight is how money gets booked twice);
// - it re-sends the SAME item (same id, BMPCC-20232 "same event republished"),
//   never a new payment, so no re-approval and no double pay-out;
// - the confirm step shows the item again before it goes;
// - copy says when it is worth pressing: now (GG was unavailable), after you
//   fixed it (handler-owned), or only if Finance asks (Finance-owned).

/** Is the claim itself registered in GG? Absent = registered (pre-GG data). */
export type GgClaimRegistration = 'registered' | 'registering' | 'failed' | 'policy-missing';

/** Booking state of one approved reserve / payment / recovery. */
export type BookingStatus = 'booking' | 'waiting-claim' | 'delayed' | 'booked' | 'needs-fixing';

/** Who has to act on a booking failure. */
export type BookingFixOwner = 'handler' | 'finance';

/** Why GG didn't book it: decides what "Send again" advice says. */
export type BookingFailureCause = 'gg-unavailable' | 'data-mismatch';

export interface BookingIssue {
  // Plain-language reason, never GG's raw error-message (that stays with support).
  reason: string;
  owner: BookingFixOwner;
  cause?: BookingFailureCause;
  // Task created for the handler when owner === 'handler'.
  taskId?: string;
  // How many times it has been sent (1 = only the original send).
  attempts?: number;
  // PROTOTYPE ONLY: what the mock does when "Send again" is pressed, so the
  // DEV banner can show both outcomes deterministically.
  demoResendOutcome?: 'booked' | 'fails-again';
  // A "Send again" is waiting for GG's answer (lets a reload resolve it).
  inFlight?: boolean;
}

/** Fields a reserve / payment / recovery row carries once it is approved. */
export interface Bookable {
  bookingStatus?: BookingStatus;
  bookingIssue?: BookingIssue;
  // Approval side: why it was rejected / sent back (shown in the expand row).
  approvalNote?: string;
}

/**
 * What the row's single status column says to the handler. One column, not
 * two: the handler asks "where is my money", not "what did approval say and
 * what did GG say". Approval states pass through; once approved, the booking
 * state takes over. `tone` groups by what the handler has to do.
 */
export type StatusTone = 'action' | 'waiting' | 'done' | 'stopped';

export interface DisplayStatus {
  label: string;
  tone: StatusTone;
}

const BOOKING_DISPLAY: Record<BookingStatus, DisplayStatus> = {
  booking: { label: 'Booking in progress', tone: 'waiting' },
  'waiting-claim': { label: 'Waiting for claim', tone: 'waiting' },
  delayed: { label: 'Booking delayed', tone: 'waiting' },
  booked: { label: 'Booked', tone: 'done' },
  'needs-fixing': { label: "Couldn't be booked", tone: 'action' }
};

// Usability review: "Requires amendment" and the GG failure looked identical.
// Approver send-backs keep the system's own words but a different tone from
// GG failures; Rejected is 'stopped' (serious, not "inactive grey").
const APPROVAL_TONE: Record<string, StatusTone> = {
  Draft: 'waiting',
  'Requires amendment': 'action',
  Pending: 'waiting',
  Rejected: 'stopped',
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

/** Is "Send again" offered on this row? */
export function canSendAgain(item: Bookable): boolean {
  return item.bookingStatus === 'needs-fixing';
}

/**
 * Plain-language explanation for the expand row of ANY status that isn't
 * self-evident (usability review: "Booking delayed", "Rejected" and
 * "Requires amendment" explained nothing). Null = no expand row needed.
 */
export interface StatusExplanation {
  heading: string;
  lines: string[];
  // Who acts: 'you' | 'finance' | 'approver' | 'nobody'.
  whoActs: 'you' | 'finance' | 'approver' | 'nobody';
  // Shown under the "Send again" button when canSendAgain().
  sendAgainHint?: string;
}

export function statusExplanation(
  approvalStatus: string,
  item: Bookable,
  noun: 'payment' | 'reserve' | 'recovery'
): StatusExplanation | null {
  const handed = HANDED_TO_GG.has(approvalStatus);
  if (approvalStatus === 'Requires amendment') {
    return {
      heading: 'Sent back to you by the approver',
      lines: [item.approvalNote ?? 'The approver asked for changes.', `Change the ${noun} and submit it again.`],
      whoActs: 'you'
    };
  }
  if (approvalStatus === 'Rejected') {
    return {
      heading: 'Rejected by the approver',
      lines: [item.approvalNote ?? 'No reason was given.', `Nothing was paid. Make a new ${noun} if it is still owed.`],
      whoActs: 'nobody'
    };
  }
  if (!handed) return null;
  switch (item.bookingStatus) {
    case 'delayed':
      return {
        heading: 'Taking longer than usual',
        lines: [
          `Global Genius hasn't answered yet. The system keeps trying on its own.`,
          `Nothing has gone wrong yet. If it fails, it moves to "Couldn't be booked" and we'll tell you.`
        ],
        whoActs: 'nobody'
      };
    case 'waiting-claim':
      return {
        heading: 'Waiting for the claim to be set up',
        lines: [`This ${noun} is booked as soon as Global Genius has set up the claim.`],
        whoActs: 'nobody'
      };
    case 'needs-fixing': {
      const issue = item.bookingIssue;
      const again = (issue?.attempts ?? 1) > 1;
      const lines = [
        issue?.reason ?? 'Global Genius did not accept it.',
        noun === 'payment' ? 'No money has been paid out.' : 'It is not in the books yet.'
      ];
      if (again) lines.push('It was sent again and still couldn\'t be booked. Contact the Finance team.');
      const hint =
        issue?.cause === 'gg-unavailable'
          ? 'Global Genius was unavailable. You can send it again now.'
          : issue?.owner === 'handler'
            ? `Once you've fixed it, send the same ${noun} again. You don't need to create a new one.`
            : 'Finance will send it again once they have fixed it. Only send it yourself if they ask you to.';
      return {
        heading: "Why this couldn't be booked",
        lines,
        whoActs: issue?.owner === 'handler' || issue?.cause === 'gg-unavailable' ? 'you' : 'finance',
        sendAgainHint: hint
      };
    }
    default:
      return null;
  }
}

/** Claim-level message, shown only when something is wrong. */
export interface ClaimRegistrationMessage {
  title: string;
  body: string;
  severity: 'error' | 'info';
  // Claim-level re-trigger (BMPCC-20232 business use case 3).
  canSendAgain: boolean;
}

export function claimRegistrationMessage(
  state: GgClaimRegistration | undefined,
  // Times the handler already sent it again and it still failed.
  resendFailures = 0
): ClaimRegistrationMessage | null {
  switch (state) {
    case 'failed':
      // Usability review: after a failed resend the banner read exactly as
      // before, so the handler couldn't tell their attempt had happened.
      if (resendFailures > 0) {
        return {
          title: "Sent again, but the claim still couldn't be set up in Global Genius",
          body: "Payments and reserves stay on hold. Finance have been told and are looking into it. You can try once more, or wait: we'll let you know when it's ready.",
          severity: 'error',
          canSendAgain: true
        };
      }
      return {
        title: "This claim isn't in Global Genius yet, so payments and reserves are on hold",
        body: "The claim couldn't be set up there. You can send it again now. Finance have been told, and we'll let you know when it's ready.",
        severity: 'error',
        canSendAgain: true
      };
    case 'policy-missing':
      return {
        title: "This claim's policy isn't in Global Genius, so payments and reserves are on hold",
        body: "The policy team has been told and needs to add it. Once they have, the claim is sent again on its own and we'll let you know.",
        severity: 'error',
        canSendAgain: false
      };
    case 'registering':
      return {
        title: 'Claim is still being set up in Global Genius',
        body: "You can carry on: anything you submit now is booked once the claim is ready. If set-up fails, we'll tell you.",
        severity: 'info',
        canSendAgain: false
      };
    default:
      return null;
  }
}
