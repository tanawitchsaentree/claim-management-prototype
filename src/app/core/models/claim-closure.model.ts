import { ClaimStatus } from './claim.model';
import { SectionStatus } from './section.model';

// ─── Status transition validation ─────────────────────────────────────────

const CLAIM_TRANSITIONS: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  'Open':        ['In progress', 'Closed'],
  'In progress': ['Closed'],
  'Closed':      ['Open'],
};

/**
 * Validates a claim status transition. Statuses outside the closure lifecycle
 * (Priced/Quoted/Bound/Declined) are unrestricted — they have no CLAIM_TRANSITIONS
 * entry, so the function returns true.
 */
export function validateClaimTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  const allowed = CLAIM_TRANSITIONS[from];
  if (!allowed) return true;
  return allowed.includes(to);
}

const SECTION_TRANSITIONS: Partial<Record<SectionStatus, SectionStatus[]>> = {
  'Open':   ['Closed'],
  'Closed': ['Open'],
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
  | 'subrogation'
  | 'deductible'
  | 'litigation'
  | 'provider'
  | 'bills'
  | 'reports';

export type ClosureReason = 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';

export interface BlockerItem {
  id: string;
  title: string;
  description: string;
  status: string;
  lastUpdated: string;
  assignee?: string;
  ownerDomain: string;
  link?: string;
  severity: 'hard' | 'warning';
}

export interface Blocker {
  type: BlockerType;
  label: string;
  count?: number;
  amount?: number;
  items?: BlockerItem[];
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
  reserveAmount: number;
  reserveType: string;
  reopenedBy: { userId: string; name: string };
}
