import { PolicyStatus } from './policy.model';

export type CoinsuranceRole = 'Leader' | 'Follower';

export interface PolicyCoverage {
  coverageId:    string;
  policySection: string;
  coverage:      string;
  sumInsured:    number;
  deductible:    number;
  currency:      string;
}

export interface CoinsuranceParticipant {
  participantCode: string;
  participant:     string;
  sharePercent:    number;
  role:            CoinsuranceRole;
}

// Derived from claims.json at read time rather than stored — a claim's
// policy linkage already lives on the claim record, so duplicating it into
// policy mock data would go stale the moment a claim moves policy (the
// CHAMP-CLOSURE-001 failure mode in CONVERSIONS.md).
//
// `createdDate` and `dateOfLoss` are here because BMPCC-16192 is precisely
// the QA defect that they were missing from this table.
export interface LinkedClaimRow {
  claimId:         string;
  lossDescription: string;
  clientName:      string;
  createdDate:     string;
  dateOfLoss:      string;
  status:          string;
}

export interface PolicyOverview {
  policyNumber:   string;
  clientName:     string;
  lineOfBusiness: string;
  status:         PolicyStatus;
  effectiveDate:  string;
  expiryDate:     string;
  premium:        number;
  currency:       string;
  allianzShare?:  number;
  coverages:      PolicyCoverage[];
  coinsurance:    CoinsuranceParticipant[];
  linkedClaims:   LinkedClaimRow[];
}
