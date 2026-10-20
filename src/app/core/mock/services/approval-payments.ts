import { FinancialPayment } from '../../models/financial-overview.model';
import { PaymentApproval } from '../../models/dashboard-extended.model';
import { RequesterNamePipe } from '../../../shared/pipes/requester-name.pipe';
import paymentApprovalsData from '../data/payment-approvals.json';

// A payment waiting in Approvals > Payments is a payment on that claim, so
// the claim's own Payments list must show it too (same id, amount, payee),
// as Pending. Before this, Approvals listed payments for CLM-2024-006/-016/
// -022/-023 while those claims' Payments pages said "No payments found".
// Only used when a claim has no seeded financial overview; CLM-2024-001's
// seed carries its approval row directly.
const requesterName = new RequesterNamePipe();

const SECTION_TYPE: Record<PaymentApproval['paymentType'], string> = {
  Indemnity: 'Indemnity',
  Settlement: 'Indemnity',
  Expense: 'Expenses',
  Provider: 'Expenses'
};

export function pendingApprovalPayments(claimId: string, date: string): FinancialPayment[] {
  return (paymentApprovalsData as PaymentApproval[])
    .filter(a => a.claimId === claimId)
    .map(a => ({
      paymentId: a.paymentId,
      reinsuranceId: '',
      payee: a.payee,
      handler: requesterName.transform(a.requester),
      sectionType: SECTION_TYPE[a.paymentType],
      status: 'Pending' as const,
      amount: a.amount,
      currency: a.currency,
      paymentDate: date
    }));
}
