// BMPCC-17927 functional review (2026-09-22): business requirements say a
// claim has exactly two statuses, Open and Closed — 'Awaiting policy' /
// 'Matched' / 'Abandoned' used to be squeezed into this same enum as if
// they were claim statuses, which they aren't; they're the orphan-claim
// (skeleton) pre-policy lifecycle, a different dimension entirely. Split
// out to SkeletonState below. A skeleton claim's `status` is 'Open' from
// creation (it's already a claim — Convert doesn't create one) or 'Closed'
// once abandoned; `skeletonState` carries which pre-policy stage it's in.
//
// 2026-09-24: the same review's other half finally enforced — 'In progress'
// / 'Priced' / 'Quoted' / 'Bound' / 'Declined' were New-Business/quote-bind
// lifecycle labels leaking onto claims (a claim is never "quoted"). Removed
// from the type and from claims.json; the claim-closure transition map,
// dashboard aggregation, and claims-list filter that referenced them were
// updated in the same pass — see CONVERSIONS.md.
export type ClaimStatus = 'Open' | 'Closed';

// Orphan-claim (skeleton) pre-policy lifecycle — independent of ClaimStatus.
// 'linked' is terminal-and-resolved (policy attached, behaves like any other
// claim from then on) — kept, not cleared, so wasConverted-style checks can
// distinguish "successfully linked" from "abandoned" (both are claimType
// 'skeleton' with no further skeleton action pending, but only one of them
// should still show the post-conversion "needs setup" banner).
export type SkeletonState = 'awaiting-policy' | 'matched' | 'abandoned' | 'linked';

/** True while a skeleton claim still has a pre-policy action pending (not yet linked). */
export function isSkeletonPending(claim: { skeletonState?: SkeletonState }): boolean {
  return (
    claim.skeletonState === 'awaiting-policy' ||
    claim.skeletonState === 'matched' ||
    claim.skeletonState === 'abandoned'
  );
}

export type MassEventLinkStatus = 'pending' | 'confirmed' | 'overridden';
export type Priority = 'high' | 'medium' | 'low';
export type LineOfBusiness = 'Property' | 'Liability' | 'Marine' | 'Cyber' | 'Engineering';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'SGD';

export type SkeletonReason =
  | 'policy_not_issued'
  | 'policy_not_found'
  | 'multi_policy_pending'
  | 'other';

export interface ClaimLocation {
  country: string;
  city: string;
}

export interface Claim {
  claimId: string;
  policyNumber: string;
  clientName: string;
  broker: string | null;
  assignee: string | null;
  createdBy: string;
  dateCreated: string;
  dateUpdated: string;
  lossDate: string;
  lossAmount: number;
  currency: Currency;
  description: string;
  status: ClaimStatus;
  priority: Priority;
  lineOfBusiness: LineOfBusiness;
  location: ClaimLocation | null;
  lossEventId: string | null;
  massEventId?: string;
  massEventLinkStatus?: MassEventLinkStatus;
  massEventLinkedBy?: { userId: string; name: string; at: string };
  massEventOverriddenBy?: { userId: string; name: string; at: string };
  group?: string;
  causeOfLoss?: string[];
  _scenario?: string;
  // Orphan (skeleton) claim fields — claimType is never cleared (historical
  // fact the claim originated as an orphan); skeletonState is only set while
  // claimType is 'skeleton'.
  claimType?: 'skeleton';
  skeletonState?: SkeletonState;
  skeletonReason?: SkeletonReason;
  linkedBy?: string | null;
  linkedDate?: string | null;
  linkedClaimId?: string;
  slaDeadlineDays?: number;
  abandonReason?: string;
}
