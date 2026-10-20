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

// Claim level (is the claim itself in GG) lives in its own file; re-exported
// here so existing imports keep working.
export * from './gg-claim-registration.model';

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
  // Review round 3: "Waiting for claim" read as waiting for the claimant.
  'waiting-claim': { label: 'Waiting for claim set-up', tone: 'waiting' },
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

/**
 * Who has to act on a failed booking, after escalation: a resend that failed
 * again moves to Finance (review round 2: "contact Finance" next to the same
 * Send again button contradicted itself).
 */
export function effectiveOwner(issue: BookingIssue | undefined): BookingFixOwner {
  if (!issue) return 'finance';
  if ((issue.attempts ?? 1) > 1) return 'finance';
  if (issue.cause === 'gg-unavailable') return 'handler';
  return issue.owner;
}

export function displayStatus(
  approvalStatus: string,
  booking?: BookingStatus,
  issue?: BookingIssue
): DisplayStatus {
  if (booking && HANDED_TO_GG.has(approvalStatus)) {
    if (booking === 'booking' && issue?.inFlight) return { label: 'Sent again, waiting', tone: 'waiting' };
    // Review round 2: one "Couldn't be booked" for "you fix it" and "Finance
    // fixes it" made the handler open every row to find out.
    if (booking === 'needs-fixing' && effectiveOwner(issue) === 'finance') {
      return { label: 'With Finance', tone: 'waiting' };
    }
    return BOOKING_DISPLAY[booking];
  }
  return { label: approvalStatus, tone: APPROVAL_TONE[approvalStatus] ?? 'waiting' };
}

/**
 * Is "Send again" offered on this row? Only when the handler is the one who
 * can usefully press it: not while a send is in flight, not when Finance owns
 * the fix, not after a resend already failed (review round 2: a prominent
 * button the handler is told not to press gets pressed).
 */
export function canSendAgain(item: Bookable): boolean {
  return (
    item.bookingStatus === 'needs-fixing' &&
    !item.bookingIssue?.inFlight &&
    effectiveOwner(item.bookingIssue) === 'handler'
  );
}

/**
 * Does this row need the handler? One rule for the list count, the Financial
 * Overview line and the bell, so the numbers agree everywhere (review round 2:
 * Payments said 4, the summary said 3).
 */
export function needsHandler(approvalStatus: string, item: Bookable): boolean {
  if (approvalStatus === 'Requires amendment') return true;
  return HANDED_TO_GG.has(approvalStatus) && canSendAgain(item);
}

/** Booked/With Finance rows the handler doesn't act on but should see. */
export function withFinance(approvalStatus: string, item: Bookable): boolean {
  return (
    HANDED_TO_GG.has(approvalStatus) &&
    item.bookingStatus === 'needs-fixing' &&
    effectiveOwner(item.bookingIssue) === 'finance'
  );
}

/**
 * Plain-language explanation for the expand row of ANY status that isn't
 * self-evident (usability review: "Booking delayed", "Rejected" and
 * "Requires amendment" explained nothing). Null = no expand row needed.
 */
export interface StatusExplanation {
  heading: string;
  lines: string[];
  whoActs: 'you' | 'finance' | 'approver' | 'nobody';
  // Shown under the "Send again" button when canSendAgain().
  sendAgainHint?: string;
  // Tick box the Send again confirm requires before it goes (label text).
  confirmFixed?: string;
}

export function statusExplanation(
  approvalStatus: string,
  item: Bookable,
  noun: 'payment' | 'reserve' | 'recovery'
): StatusExplanation | null {
  const handed = HANDED_TO_GG.has(approvalStatus);
  const notOut = noun === 'payment' ? 'No money has been paid out.' : 'It is not in the books yet.';
  if (approvalStatus === 'Requires amendment') {
    return {
      heading: 'Requires amendment: sent back to you by the approver',
      lines: [item.approvalNote ?? 'The approver asked for changes.', `Change the ${noun} and submit it again.`],
      whoActs: 'you'
    };
  }
  if (approvalStatus === 'Rejected') {
    // Review round 2: "make a new payment if still owed" on a rejected item
    // invited exactly the double payment the approver stopped.
    // Review round 3: "talk to the approver" next to "nothing for you to do"
    // contradicted itself. A rejection is final but it is the handler's to
    // close: tell the payee, or challenge it with the approver.
    return {
      heading: 'Rejected by the approver',
      lines: [
        item.approvalNote ?? 'No reason was given.',
        `Nothing was paid. Let the payee know, or talk to the approver if you think it's wrong.`
      ],
      whoActs: 'you'
    };
  }
  if (!handed) return null;
  const issue = item.bookingIssue;
  switch (item.bookingStatus) {
    case 'booking':
      if (!issue?.inFlight) return null;
      return {
        heading: 'Sent again, waiting for Global Genius',
        lines: [`The same ${noun} was sent again. ${notOut}`, "We'll tell you as soon as it's booked, or if it fails again."],
        whoActs: 'nobody'
      };
    case 'delayed':
      return {
        heading: 'Taking longer than usual',
        lines: [
          `Global Genius hasn't answered yet. The system keeps trying on its own.`,
          `Nothing has gone wrong yet. If it fails, we'll tell you.`
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
      const escalated = (issue?.attempts ?? 1) > 1;
      if (effectiveOwner(issue) === 'finance') {
        return {
          heading: escalated ? 'Sent again, still not booked: now with Finance' : "With Finance: couldn't be booked",
          // The panel adds the "Finance team is fixing it, nothing for you to
          // do" line from whoActs; repeating it here doubled it (review round 3).
          lines: [issue?.reason ?? 'Global Genius did not accept it.', notOut, "We'll let you know when it's booked."],
          whoActs: 'finance'
        };
      }
      return {
        heading: "Why this couldn't be booked",
        lines: [issue?.reason ?? 'Global Genius did not accept it.', notOut],
        whoActs: 'you',
        // Data the handler must correct first: the confirm step asks them to
        // say they did (review round 3: Send again before fixing = a trap).
        confirmFixed: issue?.cause === 'data-mismatch' ? "I've corrected it" : undefined,
        sendAgainHint:
          issue?.cause === 'gg-unavailable'
            ? 'Global Genius was unavailable. You can send it again now.'
            : `Once you've fixed it, send the same ${noun} again. You don't need to create a new one.`
      };
    }
    default:
      return null;
  }
}
