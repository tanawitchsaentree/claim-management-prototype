import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection } from '../../../core/models/section.model';

export interface MakePaymentModalData {
  section: ClaimSection;
}

export interface MakePaymentModalResult {
  amount: number;
  currency: string;
  paymentType: string;
  reference: string;
}

const PAYMENT_TYPES = ['Indemnity payment', 'Expense reimbursement', 'Interim payment', 'Final settlement'];
const CURRENCIES    = ['EUR', 'USD', 'GBP', 'CHF'];

@Component({
  selector: 'app-make-payment-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './make-payment-modal.component.html',
  styleUrl: './make-payment-modal.component.scss',
})
export class MakePaymentModalComponent {
  readonly data     = inject<MakePaymentModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<MakePaymentModalComponent, MakePaymentModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly paymentTypes = PAYMENT_TYPES;
  readonly currencies   = CURRENCIES;

  readonly form = this.fb.group({
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:    ['EUR', Validators.required],
    paymentType: ['', Validators.required],
    reference:   ['', Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.modalRef.close({
      amount:      this.form.value.amount!,
      currency:    this.form.value.currency!,
      paymentType: this.form.value.paymentType!,
      reference:   this.form.value.reference!,
    });
  }

  cancel(): void { this.modalRef.close(); }
}
