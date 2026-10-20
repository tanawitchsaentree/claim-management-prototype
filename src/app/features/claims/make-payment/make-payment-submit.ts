import { FinancialPayment } from '../../../core/models/financial-overview.model';
import { PAYMENT_METHODS, PaymentLine } from '../../../core/models/payee.model';
import { ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

// The wording of the confirm step and the payment record built on submit.
// Pure functions, so the page only decides *when* to call them.

export type SubmitMode = 'submit' | 'draft';

export function confirmData(
  mode: SubmitMode,
  editId: string | null,
  summary: string
): ConfirmDialogData {
  if (editId) {
    return {
      title: `Send payment ${editId} back to your approver?`,
      message: `This sends payment ${editId} back to your approver. No new payment is created.`,
      confirmLabel: 'Resubmit to approver',
      cancelLabel: 'Cancel',
      hideIcon: true
    };
  }
  const draft = mode === 'draft';
  return {
    title: draft ? 'Save this payment as a draft?' : 'Send this payment for approval?',
    message: draft
      ? `${summary}. It is saved as a draft and is not sent to your approver until you make the payment.`
      : `${summary}. It goes to your approver. Once approved, it is booked in Global Genius automatically.`,
    confirmLabel: draft ? 'Save draft' : 'Send for approval',
    cancelLabel: 'Cancel',
    hideIcon: true
  };
}

export interface PaymentFormValues {
  currency: string;
  bankAccountId: string | null;
  method: string | null;
  vat: boolean;
  coInsurance: 'allianz' | 'market' | null;
}

export function paymentRecord(
  v: PaymentFormValues,
  payee: { payeeId: string; name: string },
  lines: PaymentLine[],
  total: number,
  sectionType: string
): Omit<FinancialPayment, 'paymentId' | 'status'> {
  return {
    reinsuranceId: '',
    payee: payee.name,
    handler: '',
    sectionType,
    amount: total,
    currency: v.currency,
    paymentDate: '',
    lines,
    payeeId: payee.payeeId,
    bankAccountId: v.bankAccountId ?? undefined,
    method: PAYMENT_METHODS.find(m => m.value === v.method)?.value,
    vatApplicable: v.vat,
    coInsurance: v.coInsurance ?? undefined
  };
}
