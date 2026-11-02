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

/**
 * REQ + 6 digits, the same shape as Reserves request IDs (REQ483140).
 * Derived from the claim ID so the detail page can rebuild it from the URL.
 */
export function rejectionRequestId(claimId: string): string {
  let h = 0x811c9dc5;
  for (const ch of claimId) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return 'REQ' + String((h % 900000) + 100000);
}
