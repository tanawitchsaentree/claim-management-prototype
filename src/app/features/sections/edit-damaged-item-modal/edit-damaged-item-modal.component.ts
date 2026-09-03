import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import {
  BODILY_INJURY_DAMAGE,
  DAMAGE_OPTIONS,
  DamagedItem,
  FINANCIAL_LOSS_DAMAGE,
  buildDamagedItem,
  damagedItemMissingConditional,
} from '../damaged-item.config';

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

  readonly damageOptions   = DAMAGE_OPTIONS;
  readonly causedByOptions = this.lookupSvc.getCauseOfLossSync();
  readonly countryOptions  = this.lookupSvc.getCountriesSync();
  readonly roleOptions     = this.lookupSvc.getPartyRolesSync();

  readonly form = this.fb.group({
    name:        [this.data.item.name,        Validators.required],
    description: [this.data.item.description, Validators.required],
    damage:      [this.data.item.damage,      Validators.required],
    causedBy:    [this.data.item.causedBy ?? null, Validators.required],
    // No conditional validator on the branch-specific controls below: they only
    // render for their own damage type, so an always-required rule would block
    // every other type. Required-ness is checked by
    // damagedItemMissingConditional(); the validator here only exists so
    // nx-formfield's invalid styling activates after a failed submit. Same
    // reasoning as add-section-entity-modal's BI controls.
    financialLossDetails: [this.data.item.financialLossDetails ?? ''],
    injuredPartyName:     [this.data.item.injuredPartyName ?? '', Validators.required],
    injuredPartyCountry:  [this.data.item.injuredPartyCountry ?? null],
    injuredPartyRole:     [this.data.item.injuredPartyRole ?? null],
  });

  private readonly damageSig = toSignal(this.form.get('damage')!.valueChanges, {
    initialValue: this.form.value.damage ?? '',
  });
  readonly isFinancialLoss = computed(() => this.damageSig() === FINANCIAL_LOSS_DAMAGE);
  readonly isBodilyInjury  = computed(() => this.damageSig() === BODILY_INJURY_DAMAGE);

  confirm(): void {
    if (this.form.get('name')!.invalid || this.form.get('description')!.invalid
        || this.form.get('damage')!.invalid
        || damagedItemMissingConditional(this.form.value)) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close(buildDamagedItem(this.form.value));
  }

  cancel(): void { this.modalRef.close(); }
}
