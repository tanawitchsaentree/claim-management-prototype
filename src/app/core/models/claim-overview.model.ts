import { MassEventLinkStatus } from './claim.model';

export interface AccessListEntry {
  userId:   string;
  name:     string;
  role:     string;
  email?:   string;
  addedAt:  string;
}

export interface FileRestriction {
  isRestricted:  boolean;
  reason?:       string;
  restrictedBy?: { userId: string; name: string };
  restrictedAt?: string;
  accessList:    AccessListEntry[];
}

export const RESTRICTION_REASONS = [
  'VIP client',
  'Legal hold',
  'Sensitive data',
  'Regulatory investigation',
  'Other',
] as const;

export type RestrictionReason = typeof RESTRICTION_REASONS[number];

export interface ClaimFinancialSummary {
  currency: string;
  totalReserve: number;
  totalPayments: number;
  totalRecoveries: number;
  outstanding: number;
}

export interface ClaimLocation {
  street: string;
  city: string;
  country: string;
}

export interface ClaimOverview {
  claimId: string;
  client: string;
  assignedHandler: string;
  lossEventId?: string;
  status: string;
  proximateLossCause: string;
  riskScore: number;
  riskScoreMax: number;
  riskStatus: string;
  policyNumber: string;
  policyHolder: string;
  broker?: string;
  clientContact?: string;
  handler: string;
  supervisor: string;
  priority: 'high' | 'medium' | 'low';
  lineOfBusiness: string;
  dateOfLoss: string;
  dateReported?: string;
  dateCreated: string;
  description: string;
  location: ClaimLocation;
  financialSummary: ClaimFinancialSummary;

  // Closure metadata
  closureDate?: string;
  closedBy?: { userId: string; name: string };
  closureReason?: 'Claim Finalised' | 'Claim Not Pursued' | 'Claim Rejected';
  retentionDate?: string;
  retentionType?: 'default' | 'custom' | 'indefinite';

  // Reopen metadata
  reopenedDate?: string;
  reopenedBy?: { userId: string; name: string };
  reopeningReason?: string;

  // Mass Event link
  massEventId?: string;
  massEventLinkStatus?: MassEventLinkStatus;
  massEventLinkedBy?: { userId: string; name: string; at: string };
  massEventOverriddenBy?: { userId: string; name: string; at: string };

  // File restriction (BMPCC-10994) — informational only, no enforcement
  restriction?: FileRestriction;

  // Recovery Potential flag — captured during FNOL, editable post-creation
  recoveryPotential?: 'yes' | 'no' | null;
  recoveryPotentialNote?: string; // required rationale when recoveryPotential is 'no'
  // BMPCC-17779 — set to false whenever recoveryPotential flips to 'yes'; claim
  // closure is blocked until a recovery case exists. Mock-only flag (no real
  // "recovery case" entity in this prototype), mirrors hasActiveRecovery below.
  recoveryCaseCreated?: boolean;

  // Closure blockers (BMPCC-11360 AC2). Mock flags driven by dev-banner ACs.
  hasOpenPayments?:   boolean;
  hasOpenReserves?:   boolean;
  hasActiveRecovery?: boolean;
  hasOpenDeductible?: boolean;
  hasActiveLitigation?: boolean;
  hasActiveProvider?: boolean;
  hasUnpaidBills?:    boolean;
  hasIncompleteReports?: boolean;
}

export interface ClaimActivity {
  id: string;
  claimId: string;
  user: string;
  timestamp: string;
  objectType: string;
  attribute: string;
  valueOld: string | null;
  valueNew: string | null;
}

export interface ClaimOverviewViewModel {
  claim: ClaimOverview;
  activities: ClaimActivity[];
  activitiesExpanded: boolean;
}
