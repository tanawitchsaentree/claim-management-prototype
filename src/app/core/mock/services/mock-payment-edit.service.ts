import { Injectable, inject } from '@angular/core';
import { MockStateService } from '../state/mock-state.service';
import { FinancialPayment } from '../../models/financial-overview.model';

// "Requires amendment" -> Change and resubmit (usability review round 3: the
// row said "you need to act" and gave nothing to act with). Make payment
// opens with ?edit=<paymentId>, the handler changes it, and the SAME payment
// goes back to the approver: same id, status Pending, approver note cleared.
// Kept out of MockFinancialOverviewService, which is at the size limit.

export type PaymentEdit = Pick<FinancialPayment, 'payee' | 'sectionType' | 'amount' | 'currency'>;

@Injectable({ providedIn: 'root' })
export class MockPaymentEditService {
  private readonly stateSvc = inject(MockStateService);

  find(claimId: string, paymentId: string): FinancialPayment | undefined {
    return this.stateSvc.state().financialOverviews[claimId]?.payments.find(p => p.paymentId === paymentId);
  }

  /** Only a payment the approver sent back can be resubmitted. */
  resubmit(claimId: string, paymentId: string, edit: PaymentEdit): boolean {
    const fo = this.stateSvc.state().financialOverviews[claimId];
    const row = fo?.payments.find(p => p.paymentId === paymentId);
    if (!fo || row?.status !== 'Requires amendment') return false;
    const payments = fo.payments.map(p =>
      p.paymentId === paymentId ? { ...p, ...edit, status: 'Pending' as const, approvalNote: undefined } : p
    );
    this.stateSvc.patchFinancialOverview(claimId, { payments });
    return true;
  }
}
