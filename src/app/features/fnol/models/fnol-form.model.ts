import { Policy, ClientSearchResult } from '../../../core/models';
import { SkeletonReason } from '../../../core/models/skeleton-claim.model';
export type { SkeletonReason };

export interface StepConfig {
  key: string;
  route: string;
  label: string;
}

export type { ClientSearchResult };

export interface FnolSearchCriteria {
  clientName: string;
  policyNumber: string;
  underwritingYear: string | null;
  externalRef: string;
  claimLossEventNumber: string;
  dateOfLoss: string;
  broker: string;
  lineOfBusiness: string | null;
  location: string;
  operatingEntity: string | null;
}

export interface PolicySearchResult extends Policy {
  broker?: string;
}

export interface FnolSelectedClient {
  clientId: string;
  clientName: string;
}

export interface FnolSelectedPolicy {
  policyId: string;
  policyNumber: string;
}

export interface SkeletonFormValue {
  clientName: string;
  reason: SkeletonReason;
  notes?: string;
  brokerName?: string;
  brokerIpmId?: string;
  insuredName?: string;
}

export interface FnolFormValue {
  search: FnolSearchCriteria;
  selectedClient?: FnolSelectedClient;
  selectedPolicy?: FnolSelectedPolicy;
  skeleton?: SkeletonFormValue;
  skeletonClaimId?: string;
}
