export type FinancialLevel = 'claim' | 'section';

export type DeductibleApplicationMethod =
  | 'Fixed amount'
  | 'Percentage'
  | 'Percentage with minimum'
  | 'Percentage with maximum';

export interface Deductible {
  deductibleId: string;
  level: FinancialLevel;
  type: string;
  amount: number;
  currency: string;
  applicationMethod: DeductibleApplicationMethod;
  sectionId?: string;
  sectionName?: string;
}

export interface PolicyLimit {
  limitId: string;
  level: FinancialLevel;
  type: string;
  amount: number;
  currency: string;
  sectionId?: string;
  sectionName?: string;
}

export interface ClaimLimitsDeductibles {
  claimId: string;
  limits: PolicyLimit[];
  deductibles: Deductible[];
}
