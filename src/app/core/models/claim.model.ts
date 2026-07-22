export type ClaimStatus = 'In progress' | 'Priced' | 'Quoted' | 'Bound' | 'Declined' | 'Open' | 'Closed';
export type MassEventLinkStatus = 'pending' | 'confirmed';
export type Priority = 'high' | 'medium' | 'low';
export type LineOfBusiness = 'Property' | 'Liability' | 'Marine' | 'Cyber' | 'Engineering';
export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'SGD';

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
  group?: string;
  causeOfLoss?: string[];
  _scenario?: string;
}
