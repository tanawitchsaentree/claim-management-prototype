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
  readonly countryOptions  = this.lookupSvc.getCountriesSync();
  readonly roleOptions     = this.lookupSvc.getPartyRolesSync();

  readonly form = this.fb.group({
    name:        ['', Validators.required],
    description: ['', Validators.required],
    damage:      ['', Validators.required],
    causedBy:    [null as string | null, Validators.required],
    // Validators on the branch-specific controls below are for nx-formfield's
    // invalid styling only, not gating — see the same note in
    // edit-damaged-item-modal.component.ts; confirm() does the real check.
    financialLossDetails: [''],
    injuredPartyName:     ['', Validators.required],
    injuredPartyCountry:  [null as string | null],
    injuredPartyRole:     [null as string | null],
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
