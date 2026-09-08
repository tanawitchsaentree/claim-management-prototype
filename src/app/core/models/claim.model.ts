// 'Awaiting policy' / 'Matched' / 'Abandoned' are the orphan-claim (skeleton) lifecycle
// states — merged into the same Claim record instead of a separate model so a claim
// found via search, listed, or shown on the dashboard is always the same record.
export type ClaimStatus = 'In progress' | 'Priced' | 'Quoted' | 'Bound' | 'Declined' | 'Open' | 'Closed'
  | 'Awaiting policy' | 'Matched' | 'Abandoned';
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
  // Orphan (skeleton) claim fields — only set while status is
  // 'Awaiting policy' / 'Matched' / 'Abandoned'.
  claimType?: 'skeleton';
  skeletonReason?: SkeletonReason;
  linkedBy?: string | null;
  linkedDate?: string | null;
  linkedClaimId?: string;
  slaDeadlineDays?: number;
  abandonReason?: string;
}
