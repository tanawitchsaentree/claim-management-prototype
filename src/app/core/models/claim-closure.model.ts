import { ClaimStatus } from './claim.model';
import { SectionStatus } from './section.model';

// ─── Status transition validation ─────────────────────────────────────────

const CLAIM_TRANSITIONS: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  'Open': ['Closed'],
  'Closed': ['Open']
};

/** Validates a claim status transition — ClaimStatus is just Open/Closed now. */
export function validateClaimTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  const allowed = CLAIM_TRANSITIONS[from];
  if (!allowed) return true;
  return allowed.includes(to);
}

const SECTION_TRANSITIONS: Partial<Record<SectionStatus, SectionStatus[]>> = {
  'Open': ['Closed'],
  'Closed': ['Open']
};

export function validateSectionTransition(from: SectionStatus, to: SectionStatus): boolean {
  return SECTION_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Blocker types ─────────────────────────────────────────────────────────

export type BlockerType =
  | 'tasks'
  | 'sections'
  | 'payments'
  | 'reserves'
  | 'recovery'
  // BMPCC-17779 (Recoveries call, 2026-09-01). Kept separate from 'recovery'
  // above, which is about recovery activity already running and needing to be
  // wound up. These two are the opposite problem — a decision that was never
  // made, and a decision that was made but never acted on.
  | 'recovery-potential-unset'
  | 'recovery-not-set-up'
  | 'subrogation'
  | 'deductible'
  | 'litigation'
  | 'provider'
  | 'bills'
  | 'reports'
  // A converted orphan claim (claimType 'skeleton') that never had a section
  // or reserve added — the Overview "needs setup" banner used to be purely
  // informational with no enforcement, so a handler could close a claim that
  // was never actually set up. Separate from 'sections'/'reserves' above,
  // which fire on OPEN sections/reserves that exist — this fires on having
  // NONE at all yet.
  | 'needs-setup'
  // Bulk closure only: the close call itself failed (not a business rule).
  | 'close-failed';

export type ClosureReason = 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';

export interface BlockerItem {
  id: string;
  title: string;
  description: string;
  status: string;
  lastUpdated: string;
  assignee?: string;
  ownerDomain: string;
  // Open-task blockers only (BMPCC-22660): the task type, shown next to the
  // domain so the handler can tell an Approval task from a Legal one.
  typeLabel?: string;
  link?: string;
  severity: 'hard' | 'warning';
}

export interface Blocker {
  type: BlockerType;
  label: string;
  count?: number;
  amount?: number;
  items?: BlockerItem[];
  /** Route to deep-link into via a "Go to X" action — omitted when there's no dedicated page to send the handler to. */
  link?: string;
  linkLabel?: string;
}

export interface BlockerCheckResult {
  canClose: boolean;
  blockers: Blocker[];
}

export interface ClosurePayload {
  reason: ClosureReason;
  retentionType: 'default' | 'custom' | 'indefinite';
  retentionDate?: string;
  confirmedBy: { userId: string; name: string };
}

export interface ReopenPayload {
  reason: string;
  reopenedBy: { userId: string; name: string };
}

// Handler-attested statements, asked once before a claim closes, and once for a
// whole batch in bulk closure (BMPCC-22660 AC03). No system check exists for these.
export const CLOSURE_CONFIRMATION_STATEMENTS: readonly string[] = [
  'All bills against this section/claim have been received and processed',
  'All pending subrogation, salvage, or recovery activity has been resolved (or recovery potential confirmed as none)',
  'All final reports are completed',
  'Provider Management survey is completed, or rejected with a rationale provided'
];

// ─── Bulk closure (BMPCC-22660, epic BMPCC-21933 FR4) ──────────────────────

export type BulkClosureKind = 'section' | 'claim';

/** One selected item, checked against every closure rule before the handler confirms. */
export interface BulkClosureCandidate {
  id: string;
  name: string;
  detail: string;
  blockers: Blocker[];
}

export type BulkClosureOutcomeStatus = 'closed' | 'blocked' | 'failed';

/** What happened to one item when the batch ran. Items are validated again at close time. */
export interface BulkClosureOutcome {
  id: string;
  name: string;
  status: BulkClosureOutcomeStatus;
  blockers: Blocker[];
}
