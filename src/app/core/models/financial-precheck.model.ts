// Checks run on Make payment / Add reserve BEFORE submit, so problems are
// caught while the handler can still fix them instead of coming back from
// Global Genius after approval (which would mean re-creating and re-approving).
// One list, one order, one presentation for every source: GG claim
// registration (BMPCC-20232 / 19412), currency without reserve (GG/CLAWS
// decision register row 8), limit breach (BMPCC-20953), outstanding premium
// (BMPCC-21754, block-vs-warn still TBC).

import { CLAIM_SEND_AGAIN_LABEL, GgClaimRegistration } from './gg-claim-registration.model';

export type PreCheckId =
  | 'claim-not-in-gg'
  | 'claim-registering'
  | 'no-reserve-in-currency'
  | 'limit-breach'
  | 'premium-outstanding';

/** A thing the handler can do straight from the warning. */
export type PreCheckAction = 'add-reserve' | 'send-claim-again';

export interface PreCheck {
  id: PreCheckId;
  // 'block' = cannot submit; 'warn' = can submit, handler should know.
  level: 'block' | 'warn';
  title: string;
  body: string;
  // Limit breach: submit allowed only with a reason, captured next to the warning.
  needsReason?: boolean;
  // Not a problem, but Submit waits (a claim retry in flight).
  holdsSubmit?: boolean;
  action?: { kind: PreCheckAction; label: string };
  // Usability review: with an outside block (claim not in GG, unpaid premium)
  // fixing anything else first is wasted effort. These render after the
  // outside block, visually quieter, under "Once that's sorted".
  afterOutsideBlock?: boolean;
}

export interface PreCheckInput {
  journey: 'payment' | 'reserve';
  ggRegistration?: GgClaimRegistration;
  // A handler-triggered claim retry is waiting for GG's answer.
  ggResendInFlight?: boolean;
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

const ORDER: PreCheckId[] = [
  'claim-not-in-gg',
  'premium-outstanding',
  'no-reserve-in-currency',
  'limit-breach',
  'claim-registering'
];

const OUTSIDE_BLOCKS: PreCheckId[] = ['claim-not-in-gg', 'premium-outstanding'];

function money(amount: number, currency?: string): string {
  return `${currency ? currency + ' ' : ''}${amount.toLocaleString('en-GB')}`;
}

export function financialPreChecks(input: PreCheckInput): PreCheck[] {
  const out: PreCheck[] = [];
  const noun = input.journey === 'payment' ? 'payment' : 'reserve';

  if (input.ggRegistration === 'failed') {
    out.push({
      id: 'claim-not-in-gg',
      level: 'block',
      title: `You can't submit this ${noun} yet`,
      body: "This claim couldn't be set up in Global Genius, so nothing on it can be booked. Retry setting it up, or wait for Finance, who have been told. We'll let you know when it's ready.",
      action: { kind: 'send-claim-again', label: CLAIM_SEND_AGAIN_LABEL }
    });
  }
  if (input.ggRegistration === 'policy-missing') {
    out.push({
      id: 'claim-not-in-gg',
      level: 'block',
      title: `You can't submit this ${noun} yet`,
      body: "This claim's policy isn't in Global Genius yet. The policy team has been told and needs to add it. We'll let you know when it's ready."
    });
  }
  if (input.ggRegistration === 'registering' && input.ggResendInFlight) {
    // Review round 3: after Retry the box fell back to the new-claim wording
    // and Submit came back on before anyone knew whether the retry worked.
    // Same blue look as the Claim Overview "Retrying" banner (review round 4:
    // red here read as "failed again"), but Submit stays held until it lands.
    out.push({
      id: 'claim-registering',
      level: 'warn',
      holdsSubmit: true,
      title: 'Retrying: setting up this claim in Global Genius',
      body: 'This usually takes a few seconds. You can submit as soon as it works; your details are kept.'
    });
  } else if (input.ggRegistration === 'registering') {
    out.push({
      id: 'claim-registering',
      level: 'warn',
      title: 'Claim is still being set up',
      // Neutral wording: it can sit below a block in the same list, so it must not say "you can submit".
      body: `Once submitted, the ${noun} is booked as soon as Global Genius has finished setting up the claim. If that fails, we'll tell you.`
    });
  }
  if (input.journey === 'payment' && input.premiumOutstanding) {
    const block = (input.premiumMode ?? 'block') === 'block';
    out.push({
      id: 'premium-outstanding',
      level: block ? 'block' : 'warn',
      title: block ? "This policy has unpaid premium, so payments can't be made" : 'This policy has unpaid premium',
      body: block
        ? "Payments open again automatically once the premium is paid, and we'll let you know."
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
      body: `Payments are paid out of a reserve in the same currency. Add a ${input.currency} reserve where you're paying from, or change the currency.`,
      action: { kind: 'add-reserve', label: `Add a ${input.currency} reserve` }
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
        `${money(input.amount, input.currency)} is ${money(input.amount - input.limitRemaining, input.currency)} more than the ${money(input.limitRemaining, input.currency)} left on this limit. ` +
        (input.journey === 'payment'
          ? 'You can still go ahead, but you need to give a reason.'
          : 'You can still go ahead.'),
      needsReason: input.journey === 'payment'
    });
  }

  const sorted = out.sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const outside = sorted.some(c => c.level === 'block' && OUTSIDE_BLOCKS.includes(c.id));
  return sorted.map(c =>
    outside && !OUTSIDE_BLOCKS.includes(c.id) ? { ...c, afterOutsideBlock: true } : c
  );
}

export function preChecksBlockSubmit(checks: PreCheck[]): boolean {
  return checks.some(c => c.level === 'block' || c.holdsSubmit);
}
