export type PolicyStatus = 'Active' | 'Expired' | 'Cancelled' | 'Pending';

export interface Policy {
  policyNumber: string;
  clientName: string;
  lineOfBusiness: string;
  effectiveDate: string;
  expiryDate: string;
  premium: number;
  currency: string;
  status: PolicyStatus;
  allianzShare?: number;
}
