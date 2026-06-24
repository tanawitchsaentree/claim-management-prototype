import { Currency } from './claim.model';

export type ClaimPaymentStatus = 'Pending' | 'Processed' | 'Final';

export interface ClaimPayment {
  paymentId:      string;
  claimId:        string;
  sectionId:      string;
  payee:          string;
  amount:         number;
  currency:       Currency;
  status:         ClaimPaymentStatus;
  isFinalPayment: boolean;
  paymentDate:    string;
}

export interface ClaimPaymentFilters {
  claimId?:   string;
  sectionId?: string;
  status?:    ClaimPaymentStatus;
}
