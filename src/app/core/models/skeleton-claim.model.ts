export type SkeletonClaimStatus = 'awaiting-policy' | 'matched' | 'abandoned';

export type SkeletonReason =
  | 'policy_not_issued'
  | 'policy_not_found'
  | 'multi_policy_pending'
  | 'other';

export interface SkeletonClaim {
  claimId: string;
  claimType: 'skeleton';
  clientName: string;
  lossDescription: string;
  lossDate: string | null;
  createdBy: string;
  createdDate: string;
  assignee: string | null;
  status: SkeletonClaimStatus;
  skeletonReason: SkeletonReason;
  policyId: string | null;
  linkedBy: string | null;
  linkedDate: string | null;
  daysSinceCreation: number;
  slaDeadlineDays: number;
  linkedClaimId?: string;
  abandonReason?: string;
}

export interface CreateSkeletonData {
  clientName: string;
  reason: SkeletonReason;
  notes?: string;
  lossDate?: string | null;
  createdBy: string;
  // Notifier free-text fields (BMPCC-241 — orphan claim)
  brokerName?: string;
  insuredName?: string;
  internalNotifier?: string;
}
