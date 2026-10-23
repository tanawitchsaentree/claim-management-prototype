import { PayeeBankAccount } from './payee.model';

export type PartyRole =
  | 'client'
  | 'broker'
  | 'insured'
  | 'claimant'
  | 'third-party'
  | 'witness'
  | 'expert'
  | 'authority';

export type ClearanceStatus = 'cleared' | 'not-cleared' | 'pending' | 'not-applicable';

export type IdType = 'national-id' | 'vat' | 'tax-id' | 'passport' | 'company-registration';

export interface Party {
  partyId: string;
  legalName: string;
  dbaTradeName?: string;
  roles: PartyRole[];
  recentlyAdded?: boolean;
  clearanceStatus: ClearanceStatus;
  email?: string;
  phone?: string;
  landline?: string;
  // Further addresses a letter can go to, besides the street/city fields above.
  otherAddresses?: string[];
  country?: string;
  city?: string;
  postalCode?: string;
  street?: string;
  streetNumber?: string;
  province?: string;
  idType?: IdType;
  idNumber?: string;
  lineOfBusiness?: string;
  operatingEntity?: string;
  // Hierarchy fields — see docs/PARTIES_ASSUMPTIONS.md (PENDING_PO_CONFIRMATION)
  claimId?: string;
  sectionId?: string;
  // Make payment: where this party can be paid, and its Global Genius Name
  // Code from Names Management (GG can't book a payment to a party without it).
  bankAccounts?: PayeeBankAccount[];
  ggNameCode?: string;
}

// View-model types — computed at render time, never persisted
export interface PartySection {
  sectionId: string;
  expanded: boolean;
  parties: Party[];
}

export interface PartyClaim {
  claimId: string;
  expanded: boolean;
  directParties: Party[];
  sections: PartySection[];
}

export interface PartyFilters {
  legalName: string;
  partyRole: string;
  country: string;
  city: string;
  postalCode: string;
  street: string;
  partyId: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  lineOfBusiness: string;
  operatingEntity: string;
  clearanceStatus: string;
}

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  'client': 'Client',
  'broker': 'Broker',
  'insured': 'Insured',
  'claimant': 'Claimant',
  'third-party': 'Third party',
  'witness': 'Witness',
  'expert': 'Expert',
  'authority': 'Authority'
};

export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
  'cleared': 'Cleared',
  'not-cleared': 'Not cleared',
  'pending': 'Pending',
  'not-applicable': 'Not applicable'
};

export const ID_TYPE_LABELS: Record<IdType, string> = {
  'national-id': 'National ID',
  'vat': 'VAT',
  'tax-id': 'Tax ID',
  'passport': 'Passport',
  'company-registration': 'Company registration'
};
