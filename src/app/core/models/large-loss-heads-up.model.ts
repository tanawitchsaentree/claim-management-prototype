// Large Loss Heads-Up (BMPCC-22350, epic BMPCC-18615, Features A-D). The
// referral of a medium/large loss to the Global Practice Groups through Key
// Case Management. Not the dashboard's "Heads-up: Monitored Claims" widget:
// that is the KCM monitoring list (Features E-F, out of scope here).
//
// DESIGN DECISION HU-1 (open questions in the story, decided for the design):
// - Q1 required before submit: Cat, Multiple LOBs, the Loss, Rationale and
//   Strategy texts, and the pre-filled values marked required below (they can
//   be typed in when the claim doesn't have them). Same for every LoB until
//   KCM says otherwise.
// - Q2 manual creation: the handler ticks one or more reasons (a loss can be
//   both high publicity and a reputational risk). Each reason has a one-line
//   hint so the boundaries are visible.
// - Q3 after submit: read-only. Changes after that go to KCM, not into the
//   submitted form (a referral that changes silently after it was read is
//   worse than a second message).
// - Q4 free text: 4000 characters is the limit, with a counter. Plain text,
//   no formatting.
// - Q5 attachments: PDF, Word, Excel, Outlook mail, JPG, PNG; up to 25 MB each
//   and 10 files. Placeholder values until the Document service sets them.
// - Q6 missing pre-fill: the field stays empty with "Not on the claim yet,
//   enter it yourself"; financial data from Finance can be pending as a block.
// - Q7 labels OE / LOE / IIP / ART share / AZRe / Cat kept as the business
//   wrote them, until KCM confirms what to spell out.
// - Q8 entry point: a "Large loss Heads-Up" card on Claim Overview, the form
//   is a full page (same shape as Make payment: header, sections, sticky
//   footer with Cancel / Save draft / Submit).

/** Incurred at or above this (EUR/USD, inclusive) triggers the Heads-Up. */
export const HEADS_UP_THRESHOLD = 1_000_000;

export type HeadsUpReason =
  | 'potential-large-loss'
  | 'public-interest'
  | 'high-publicity'
  | 'reputational-risk'
  | 'board-attention'
  | 'coverage-issue'
  | 'oe-dispute'
  | 'dno-class-action';

export const HEADS_UP_REASONS: { value: HeadsUpReason; label: string; hint: string }[] = [
  {
    value: 'potential-large-loss',
    label: 'May reach 1M or more',
    hint: 'Incurred is still below 1M, but you expect it to get there.'
  },
  { value: 'public-interest', label: 'Public interest', hint: 'The loss affects the public, e.g. injuries or a public site.' },
  { value: 'high-publicity', label: 'High publicity', hint: 'The press or social media are covering it.' },
  { value: 'reputational-risk', label: 'Reputational risk', hint: 'How we handle it could harm Allianz’s name.' },
  {
    value: 'board-attention',
    label: 'AGCS Board or Allianz Group attention',
    hint: 'The Board or the Group has asked about it or will.'
  },
  {
    value: 'coverage-issue',
    label: 'Fundamental coverage issue for the LoB',
    hint: 'The question of cover would matter for the whole line of business.'
  },
  { value: 'oe-dispute', label: 'Dispute or subrogation between OEs', hint: 'Two Allianz entities disagree or claim from each other.' },
  { value: 'dno-class-action', label: 'Securities-related D&O class action', hint: 'A shareholder class action under a D&O policy.' }
];

export type PrefillKey =
  | 'lineOfBusiness'
  | 'dateOfLoss'
  | 'oe'
  | 'causeOfLoss'
  | 'countryOfLoss'
  | 'lossLocation'
  | 'insuredName'
  | 'policyNumber'
  | 'inceptionDate'
  | 'expiryDate'
  | 'currency'
  | 'priorGross'
  | 'currentGross'
  | 'priorNet'
  | 'currentNet'
  | 'artShare'
  | 'azreExposure';

export type PrefillGroup = 'claim' | 'policy' | 'financial';

export interface PrefillField {
  key: PrefillKey;
  label: string;
  group: PrefillGroup;
  kind: 'text' | 'date' | 'amount' | 'percent';
  required: boolean;
}

export const PREFILL_FIELDS: PrefillField[] = [
  { key: 'lineOfBusiness', label: 'Line of business', group: 'claim', kind: 'text', required: true },
  { key: 'dateOfLoss', label: 'Date of loss', group: 'claim', kind: 'date', required: true },
  { key: 'oe', label: 'OE (LOE for IIP claims)', group: 'claim', kind: 'text', required: true },
  { key: 'causeOfLoss', label: 'Cause of loss', group: 'claim', kind: 'text', required: true },
  { key: 'countryOfLoss', label: 'Country of loss', group: 'claim', kind: 'text', required: true },
  { key: 'lossLocation', label: 'Loss location', group: 'claim', kind: 'text', required: false },
  { key: 'insuredName', label: 'Insured name', group: 'policy', kind: 'text', required: true },
  { key: 'policyNumber', label: 'Policy number', group: 'policy', kind: 'text', required: true },
  { key: 'inceptionDate', label: 'Inception date', group: 'policy', kind: 'date', required: false },
  { key: 'expiryDate', label: 'Expiry date', group: 'policy', kind: 'date', required: false },
  { key: 'currency', label: 'Currency', group: 'financial', kind: 'text', required: true },
  { key: 'priorGross', label: 'Prior gross incurred', group: 'financial', kind: 'amount', required: false },
  { key: 'currentGross', label: 'Current gross incurred', group: 'financial', kind: 'amount', required: true },
  { key: 'priorNet', label: 'Prior net incurred', group: 'financial', kind: 'amount', required: false },
  { key: 'currentNet', label: 'Current net incurred', group: 'financial', kind: 'amount', required: false },
  { key: 'artShare', label: 'ART share', group: 'financial', kind: 'percent', required: false },
  { key: 'azreExposure', label: 'AZRe exposure', group: 'financial', kind: 'amount', required: false }
];

export const PREFILL_GROUPS: { group: PrefillGroup; heading: string }[] = [
  { group: 'claim', heading: 'Loss' },
  { group: 'policy', heading: 'Policy' },
  { group: 'financial', heading: 'Financial data' }
];

export type HeadsUpTextKey = 'loss' | 'policyStructure' | 'rationale' | 'strategy';

export const HEADS_UP_TEXT_MAX = 4000;

export const HEADS_UP_TEXTS: { key: HeadsUpTextKey; label: string; hint: string; required: boolean }[] = [
  { key: 'loss', label: 'Loss', hint: 'What happened, what is damaged, who is affected.', required: true },
  { key: 'policyStructure', label: 'Policy structure', hint: 'Layers, shares, co-insurers, reinsurance.', required: false },
  { key: 'rationale', label: 'Rationale for loss estimation', hint: 'How you got to the incurred figure.', required: true },
  { key: 'strategy', label: 'Strategy / next steps', hint: 'What happens next and who does it.', required: true }
];

export const HEADS_UP_ATTACHMENT_TYPES = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.msg', '.jpg', '.jpeg', '.png'];
export const HEADS_UP_ATTACHMENT_MAX_MB = 25;
export const HEADS_UP_ATTACHMENT_MAX_FILES = 10;

export interface HeadsUpAttachment {
  id: string;
  fileName: string;
  size: number;
  source: 'claim' | 'upload';
  status: 'uploading' | 'uploaded' | 'failed';
}

export type YesNo = 'yes' | 'no';

export interface HeadsUpThresholdNotice {
  reachedAt: string;
  incurred: number;
  currency: string;
  // new-draft: the system created this draft; existing: it already existed.
  notice: 'new-draft' | 'existing';
  // The handler opened it; the bell line goes away (notified once).
  seen?: boolean;
}

export interface LargeLossHeadsUp {
  id: string;
  origin: 'threshold' | 'manual';
  reasons: HeadsUpReason[];
  reasonNote?: string;
  status: 'draft' | 'submitted';
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  submittedAt?: string;
  submittedBy?: string;
  threshold?: HeadsUpThresholdNotice;
  // Snapshot taken once, when the Heads-Up is created: later claim changes do
  // not change it. null = the claim didn't have it. Built on first open when
  // absent (DEV banner records leave it out).
  prefill?: Partial<Record<PrefillKey, string | null>>;
  // Finance hasn't sent the financial figures yet.
  financialPending?: boolean;
  // What the handler typed over a pre-filled value (or filled in).
  values?: Partial<Record<PrefillKey, string>>;
  cat?: YesNo | null;
  multipleLobs?: YesNo | null;
  texts?: Partial<Record<HeadsUpTextKey, string>>;
  attachments?: HeadsUpAttachment[];
  // PROTOTYPE ONLY: the next save fails once, so the error state can be shown.
  demoSaveFails?: boolean;
}

export function incurredOf(fs: { totalPayments: number; outstanding: number } | undefined): number {
  return fs ? fs.totalPayments + fs.outstanding : 0;
}
