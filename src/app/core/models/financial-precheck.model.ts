// Checks run on Make payment / Add reserve BEFORE submit, so problems are
// caught while the handler can still fix them instead of coming back from
// Global Genius after approval (which would mean re-creating and re-approving).
// One list, one order, one presentation for every source: GG claim
// registration (BMPCC-20232 / 19412), currency without reserve (GG/CLAWS
// decision register row 8), limit breach (BMPCC-20953), outstanding premium
// (BMPCC-21754, block-vs-warn still TBC).

import { GgClaimRegistration } from './gg-booking.model';

export type PreCheckId =
  | 'claim-not-in-gg'
  | 'claim-registering'
  | 'no-reserve-in-currency'
  | 'limit-breach'
  | 'premium-outstanding';

export interface PreCheck {
  id: PreCheckId;
  // 'block' = cannot submit; 'warn' = can submit, handler should know.
  level: 'block' | 'warn';
  title: string;
  body: string;
  // Limit breach: submit allowed only with a reason, captured next to the warning.
  needsReason?: boolean;
}

export interface PreCheckInput {
  journey: 'payment' | 'reserve';
  ggRegistration?: GgClaimRegistration;
  premiumOutstanding?: boolean;
  // Undecided in BMPCC-21754; the prototype shows both so the team can pick.
  premiumMode?: 'block' | 'warn';
  currency?: string;
  // Currencies that have an open reserve on the chosen section (payments only).
  reserveCurrencies?: string[];
  amount?: number;
  // Remaining headroom on the tightest applicable limit, same currency as amount.
  limitRemaining?: number;
  limitName?: string;
}

// Blocks first, then warnings; within each, the order a handler can act on them.
const ORDER: PreCheckId[] = [
  'claim-not-in-gg',
  'premium-outstanding',
  'no-reserve-in-currency',
  'limit-breach',
  'claim-registering'
];

export function financialPreChecks(input: PreCheckInput): PreCheck[] {
  const out: PreCheck[] = [];
  const noun = input.journey === 'payment' ? 'payment' : 'reserve';

  if (input.ggRegistration === 'failed' || input.ggRegistration === 'policy-missing') {
    out.push({
      id: 'claim-not-in-gg',
      level: 'block',
      title: `You can't submit this ${noun} yet`,
      body:
        input.ggRegistration === 'failed'
          ? "This claim couldn't be set up in Global Genius. The Finance team is fixing it. You can save your work and submit once it's resolved."
          : "This claim's policy isn't in Global Genius yet. The policy team needs to add it before anything can be booked."
    });
  }
  if (input.ggRegistration === 'registering') {
    out.push({
      id: 'claim-registering',
      level: 'warn',
      title: 'Claim is still being set up',
      // Neutral wording: it can sit below a block in the same list, so it must not say "you can submit".
      body: `Once submitted, the ${noun} is booked as soon as Global Genius has finished setting up the claim.`
    });
  }
  if (input.journey === 'payment' && input.premiumOutstanding) {
    const block = (input.premiumMode ?? 'block') === 'block';
    out.push({
      id: 'premium-outstanding',
      level: block ? 'block' : 'warn',
      title: block ? "This policy has unpaid premium, so payments can't be made" : 'This policy has unpaid premium',
      body: block
        ? 'Payments open again automatically once the premium is paid.'
        : 'Check with the underwriter before paying out on this claim.'
    });
  }
  if (
    input.journey === 'payment' &&
    input.currency &&
    input.reserveCurrencies &&
    !input.reserveCurrencies.includes(input.currency)
  ) {
    out.push({
      id: 'no-reserve-in-currency',
      level: 'block',
      title: `There's no ${input.currency} reserve to pay from`,
      body: `Add a ${input.currency} reserve on this section first, then come back to make the payment.`
    });
  }
  if (
    input.amount !== undefined &&
    input.limitRemaining !== undefined &&
    input.amount > input.limitRemaining
  ) {
    out.push({
      id: 'limit-breach',
      level: 'warn',
      title: `This ${noun} goes over the ${input.limitName ?? 'policy limit'}`,
      // Reason capture is payment-only (BMPCC-20953); Add reserve must not ask for one.
      body:
        `Only ${input.limitRemaining.toLocaleString('en-GB')} is left on this limit. ` +
        (input.journey === 'payment'
          ? 'You can still go ahead, but you need to give a reason.'
          : 'You can still go ahead.'),
      needsReason: input.journey === 'payment'
    });
  }

  return out.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

export function preChecksBlockSubmit(checks: PreCheck[]): boolean {
  return checks.some(c => c.level === 'block');
}
