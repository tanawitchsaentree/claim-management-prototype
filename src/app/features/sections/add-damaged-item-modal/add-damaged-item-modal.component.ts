import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { FINANCIAL_LOSS_DAMAGE, DAMAGE_OPTIONS } from '../damaged-item.config';
import { DamagedItem } from '../edit-damaged-item-modal/edit-damaged-item-modal.component';

export interface AddDamagedItemModalData {
  entityName: string;
}

export type AddDamagedItemModalResult = DamagedItem;

@Component({
  selector: 'app-add-damaged-item-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './add-damaged-item-modal.component.html',
  styleUrl: './add-damaged-item-modal.component.scss',
})
export class AddDamagedItemModalComponent {
  readonly data     = inject<AddDamagedItemModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddDamagedItemModalComponent, AddDamagedItemModalResult>>(NxModalRef);
  private readonly fb        = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);

  readonly damageOptions   = DAMAGE_OPTIONS;
  readonly causedByOptions = this.lookupSvc.getCauseOfLossSync();

  readonly form = this.fb.group({
    name:        ['', Validators.required],
    description: ['', Validators.required],
    damage:      ['', Validators.required],
    // Validator present but not conditional — see the same note in
    // edit-damaged-item-modal.component.ts; confirm() does the real check.
    financialLossCausedBy: [null as string | null, Validators.required],
    financialLossDetails:  [''],
  });

  private readonly damageSig = toSignal(this.form.get('damage')!.valueChanges, {
    initialValue: this.form.value.damage ?? '',
  });
  readonly isFinancialLoss = computed(() => this.damageSig() === FINANCIAL_LOSS_DAMAGE);

  confirm(): void {
    const missingCausedBy = this.isFinancialLoss() && !this.form.value.financialLossCausedBy;
    if (this.form.get('name')!.invalid || this.form.get('description')!.invalid
        || this.form.get('damage')!.invalid || missingCausedBy) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close({
      name:        this.form.value.name!,
      description: this.form.value.description!,
      damage:      this.form.value.damage!,
      ...(this.isFinancialLoss()
        ? {
            financialLossCausedBy: this.form.value.financialLossCausedBy ?? undefined,
            financialLossDetails:  this.form.value.financialLossDetails  || undefined,
          }
        : {}),
    });
  }

  cancel(): void { this.modalRef.close(); }
}
