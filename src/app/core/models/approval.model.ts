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

/** BMPCC-17630 — a claim rejection waiting for approval. */
export interface RejectionApproval {
  requestId: string;
  claimId: string;
  oe: string;
  client: string;
  lineOfBusiness: string;
  requester: string;
  dateRequested: string;
  /** Seeded rows carry none and count as coverage-related. */
  rejectionType?: 'coverage' | 'liability';
  /** The handler's reason, shown to the approver. */
  rejectionReason?: string;
}

/** REJ2024006 for CLM-2024-006 — stable, so the detail URL can be rebuilt from the claim. */
export function rejectionRequestId(claimId: string): string {
  return 'REJ' + claimId.replace(/\D/g, '');
}
