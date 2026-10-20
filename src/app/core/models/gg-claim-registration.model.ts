// Global Genius — claim level (BMPCC-20232, 19412): is the claim itself set up
// in GG, and what the claim banner says. Item level is in gg-booking.model.ts.

/** Is the claim itself registered in GG? Absent = registered (pre-GG data). */
export type GgClaimRegistration = 'registered' | 'registering' | 'failed' | 'policy-missing';

/** Claim-level message, shown only when something is wrong. */
export interface ClaimRegistrationMessage {
  title: string;
  body: string;
  severity: 'error' | 'info';
  // Claim-level re-trigger (BMPCC-20232 business use case 3).
  canSendAgain: boolean;
  sendAgainLabel?: string;
}

// Review round 2: "Send claim again" could read as creating a second claim.
export const CLAIM_SEND_AGAIN_LABEL = 'Retry setting up this claim in Global Genius';

export function claimRegistrationMessage(
  state: GgClaimRegistration | undefined,
  // Times the handler already sent it again and it still failed.
  resendFailures = 0,
  // A handler-triggered retry is waiting for GG's answer.
  resendInFlight = false
): ClaimRegistrationMessage | null {
  switch (state) {
    case 'failed':
      if (resendFailures >= 2) {
        return {
          title: "Still couldn't set up this claim in Global Genius: now with Finance",
          body: "Payments and reserves stay on hold. Retrying again won't help: the Finance team is fixing it. We'll let you know when it's ready.",
          severity: 'error',
          canSendAgain: false
        };
      }
      if (resendFailures === 1) {
        return {
          title: "Retried, but the claim still couldn't be set up in Global Genius",
          body: "Payments and reserves stay on hold. Finance have been told. You can retry once more, or wait: we'll let you know when it's ready.",
          severity: 'error',
          canSendAgain: true,
          sendAgainLabel: CLAIM_SEND_AGAIN_LABEL
        };
      }
      return {
        title: "This claim isn't in Global Genius yet, so payments and reserves are on hold",
        body: "The claim couldn't be set up there. You can retry now. Finance have been told, and we'll let you know when it's ready.",
        severity: 'error',
        canSendAgain: true,
        sendAgainLabel: CLAIM_SEND_AGAIN_LABEL
      };
    case 'policy-missing':
      return {
        title: "This claim's policy isn't in Global Genius, so payments and reserves are on hold",
        body: "The policy team has been told and needs to add it. Once they have, the claim is set up on its own and we'll let you know.",
        severity: 'error',
        canSendAgain: false
      };
    case 'registering':
      if (resendInFlight) {
        return {
          title: 'Retrying: setting up this claim in Global Genius',
          body: "Your retry has been sent. This usually takes a few seconds. We'll tell you if it works or not.",
          severity: 'info',
          canSendAgain: false
        };
      }
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
