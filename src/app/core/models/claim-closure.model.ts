export type BlockerType =
  | 'tasks'
  | 'sections'
  | 'payments'
  | 'reserves'
  | 'recovery'
  | 'deductible'
  | 'litigation'
  | 'provider'
  | 'bills'
  | 'reports';

export type ClosureReason = 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';

export interface Blocker {
  type: BlockerType;
  label: string;
  count?: number;
  amount?: number;
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
