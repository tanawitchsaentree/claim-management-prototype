import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { FinancialReserve, FinancialReserveStatus, FinancialSection } from '../../../../../core/models/financial-overview.model';

export interface AddReserveModalData {
  sections: FinancialSection[];
}

export type AddReserveModalResult = Omit<FinancialReserve, 'reserveId'> | null;

const RESERVE_TYPES = ['Indemnity', 'Expenses'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];
const STATUSES: FinancialReserveStatus[] = ['Pending', 'Approved'];

@Component({
  selector: 'app-add-reserve-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxInputModule, NxDropdownModule, NxButtonModule, NxIconModule],
  templateUrl: './add-reserve-modal.component.html',
  styleUrl: './add-reserve-modal.component.scss',
})
export class AddReserveModalComponent {
  readonly data     = inject<AddReserveModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddReserveModalComponent, AddReserveModalResult>>(NxModalRef);

  readonly reserveTypes = RESERVE_TYPES;
  readonly currencies   = CURRENCIES;
  readonly statuses     = STATUSES;

  readonly form = new FormGroup({
    reserveType:    new FormControl<string | null>(null, [Validators.required]),
    reserveSubType: new FormControl('', [Validators.required]),
    party:          new FormControl('', [Validators.required]),
    damagedItem:    new FormControl(''),
    section:        new FormControl<string | null>(null),
    reserveValue:   new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency:       new FormControl<string | null>('EUR', [Validators.required]),
    status:         new FormControl<FinancialReserveStatus | null>('Pending', [Validators.required]),
  });

  submitted = false;

  onCancel(): void { this.modalRef.close(null); }

  onSave(): void {
    this.submitted = true;
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.modalRef.close({
      reserveType:    v.reserveType!,
      reserveSubType: v.reserveSubType!,
      party:          v.party!,
      damagedItem:    v.damagedItem ?? '',
      section:        v.section ?? '',
      reserveValue:   v.reserveValue!,
      currency:       v.currency!,
      status:         v.status!,
    });
  }
}
