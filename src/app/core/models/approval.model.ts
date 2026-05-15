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
}
