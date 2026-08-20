import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { MockLimitsDeductiblesService } from '../../../../../core/mock/services/mock-limits-deductibles.service';
import { Deductible } from '../../../../../core/models/deductible.model';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

export interface MakePaymentModalData {
  claimId: string;
  sectionId: string;
  sectionName: string;
  currency: string;
}

export interface MakePaymentModalResult {
  amount: number;
  deductibleId: string | null;
  netAmount: number;
}

@Component({
  selector: 'app-make-payment-modal',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxRadioModule,
    EmptyStateComponent,
  ],
  templateUrl: './make-payment-modal.component.html',
  styleUrl: './make-payment-modal.component.scss',
})
export class MakePaymentModalComponent implements OnInit {
  readonly data = inject<MakePaymentModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<MakePaymentModalComponent, MakePaymentModalResult | null>>(NxModalRef);
  private readonly svc = inject(MockLimitsDeductiblesService);

  readonly deductibles = signal<Deductible[]>([]);

  readonly form = new FormGroup({
    amount: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.01)] }),
    deductibleId: new FormControl<string | null>(null),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly selectedDeductible = computed<Deductible | null>(() => {
    const id = this.formValue().deductibleId;
    return this.deductibles().find(d => d.deductibleId === id) ?? null;
  });

  readonly netAmount = computed<number>(() => {
    const amount = this.formValue().amount ?? 0;
    const deductible = this.selectedDeductible();
    if (!deductible) return amount;
    const reduction = deductible.applicationMethod === 'Percentage'
      ? amount * (deductible.amount / 100)
      : deductible.amount;
    return Math.max(0, amount - reduction);
  });

  async ngOnInit(): Promise<void> {
    const all = await firstValueFrom(this.svc.getApplicableDeductibles(this.data.claimId, this.data.sectionId));
    this.deductibles.set(all);
  }

  onCancel(): void { this.modalRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.modalRef.close({
      amount: raw.amount as number,
      deductibleId: raw.deductibleId,
      netAmount: this.netAmount(),
    });
  }
}
