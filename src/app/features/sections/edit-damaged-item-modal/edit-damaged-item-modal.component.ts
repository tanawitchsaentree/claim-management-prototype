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

export interface DamagedItem {
  name: string;
  description: string;
  damage: string;
  // Only meaningful when damage === 'Financial loss'. A financial loss has no
  // physical thing to inspect, so the peril that produced it and the working of
  // how it was arrived at are the whole record — see damaged-item.config.ts.
  financialLossCausedBy?: string;
  financialLossDetails?:  string;
}

export interface EditDamagedItemModalData {
  item: DamagedItem;
}

export type EditDamagedItemModalResult = DamagedItem;

@Component({
  selector: 'app-edit-damaged-item-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './edit-damaged-item-modal.component.html',
  styleUrl: './edit-damaged-item-modal.component.scss',
})
export class EditDamagedItemModalComponent {
  readonly data     = inject<EditDamagedItemModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<EditDamagedItemModalComponent, EditDamagedItemModalResult>>(NxModalRef);
  private readonly fb        = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);

  readonly damageOptions     = DAMAGE_OPTIONS;
  readonly causedByOptions   = this.lookupSvc.getCauseOfLossSync();

  readonly form = this.fb.group({
    name:        [this.data.item.name,        Validators.required],
    description: [this.data.item.description, Validators.required],
    damage:      [this.data.item.damage,      Validators.required],
    // No conditional validator: these controls only render when the damage type
    // is Financial loss, so an always-required rule would block every other
    // type. Required-ness is checked by hand in confirm(); the validator here
    // only exists so nx-formfield's invalid styling activates after a failed
    // submit. Same reasoning as add-section-entity-modal's BI controls.
    financialLossCausedBy: [this.data.item.financialLossCausedBy ?? null, Validators.required],
    financialLossDetails:  [this.data.item.financialLossDetails  ?? ''],
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
      // Dropped, not merely hidden, when the type is no longer Financial loss —
      // leaving a stale peril on a material-damage item would show up on the
      // item row as a cause that nothing on screen let the handler set.
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
