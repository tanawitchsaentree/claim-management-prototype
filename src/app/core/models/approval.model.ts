import type { ReserveType } from './reserve.model';
export type { ReserveType } from './reserve.model';

export interface UrgentApproval {
  requestId: string;
  claimId: string;
  oe: string;
  lineOfBusiness: string;
  reserveType: ReserveType;
  currency: string;
  amount: number;
  requester: string;
  reviewerEmail?: string;
  dateRequested?: string;
}

/** BMPCC-17630 — a coverage-related claim rejection waiting for second-level approval. */
export interface RejectionApproval {
  claimId: string;
  client: string;
  lineOfBusiness: string;
  requester: string;
  dateRequested: string;
}
