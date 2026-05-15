export type PolicyStatus = 'Active' | 'Expired' | 'Cancelled' | 'Pending';

export interface ClientSearchResult {
  partyId: string;
  legalName: string;
  address: string;
  country: string;
  role: string;
  activePolicyCount: number;
}

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
