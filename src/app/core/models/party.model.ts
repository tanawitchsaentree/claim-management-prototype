import { PayeeBankAccount } from './payee.model';

// BMPCC-12160: parties that come from the policy (client, broker, insured) are
// "default parties". IPM receives them as they are and the handler can't change
// their role. Every other party gets exactly one claim role, from the list in
// the Jira story (Names Management "Role" dropdown).
export type DefaultPartyRole = 'client' | 'broker' | 'insured';
export type ClaimPartyRole = 'claimant' | 'claims-third-party' | 'lawyer' | 'loss-adjuster' | 'other';
export type PartyRole = DefaultPartyRole | ClaimPartyRole;

export type ClearanceStatus = 'cleared' | 'not-cleared' | 'pending' | 'not-applicable';

export type IdType = 'national-id' | 'vat' | 'tax-id' | 'passport' | 'company-registration';

export interface Party {
  partyId: string;
  legalName: string;
  dbaTradeName?: string;
  // A default party can hold several policy roles (e.g. client and insured);
  // any other party holds exactly one claim role (BMPCC-12160).
  roles: PartyRole[];
  // BMPCC-12160: free alphanumeric value the handler can add or change at any time.
  referenceNumber?: string;
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

export const CLAIM_PARTY_ROLE_LABELS: Record<ClaimPartyRole, string> = {
  'claimant': 'Claimant',
  'claims-third-party': 'Claims Third Party',
  'lawyer': 'Lawyer',
  'loss-adjuster': 'Loss Adjuster',
  'other': 'Other'
};

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  'client': 'Client',
  'broker': 'Broker',
  'insured': 'Insured',
  ...CLAIM_PARTY_ROLE_LABELS
};

const DEFAULT_PARTY_ROLES: readonly PartyRole[] = ['client', 'broker', 'insured'];

export function isDefaultParty(party: Pick<Party, 'roles'>): boolean {
  return party.roles.some(r => DEFAULT_PARTY_ROLES.includes(r));
}

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
