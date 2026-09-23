export type PolicyStatus = 'Active' | 'Expired' | 'Cancelled' | 'Pending';

export interface Policy {
  policyNumber: string;
  clientName: string;
  clientNameCode?: string;
  lineOfBusiness: string;
  effectiveDate: string;
  expiryDate: string;
  premium: number;
  currency: string;
  status: PolicyStatus;
  allianzShare?: number;
  broker?: string;
  brokerNameCode?: string;
  leadInsurerPolicyNo?: string;
  businessRole?: string;
  businessOwnedBy?: string;
}
