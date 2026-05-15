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
  lossEventId: string;
  status: string;
  proximateLossCause: string;
  riskScore: number;
  riskScoreMax: number;
  riskStatus: string;
  policyNumber: string;
  policyHolder: string;
  broker: string;
  handler: string;
  supervisor: string;
  priority: 'high' | 'medium' | 'low';
  lineOfBusiness: string;
  dateOfLoss: string;
  dateReported: string;
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
