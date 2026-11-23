import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import {
  RESERVE_TYPES,
  RESERVE_TYPE_LABELS,
  ReserveType
} from '../../../../core/models/reserve.model';
import {
  ReserveClaim,
  ReserveLinePick,
  ReserveSectionOption
} from '../../services/reserve-claims.service';

export interface AddReserveModalData {
  claim: ReserveClaim;
}

export type AddReserveResult = ReserveLinePick;

/**
 * Production's Add reserve dialog (claims-management-main ReservesPage.ts):
 * Section, Party, Damage, Reserve type, each enabled once the one before is
 * chosen, then "Proceed to add" opens the reserve editor. Changing a choice
 * clears the ones after it. DESIGN DECISION RES-D3: a list with a single
 * option is picked for the handler, so with one section and one party the
 * flow is Section, then Reserve type, as in production's newer smoke flow
 * ("this flow has no Party dropdown", ReservesPage.ts:681-738).
 */
@Component({
  selector: 'app-add-reserve-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule
  ],
  templateUrl: './add-reserve-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './add-reserve-modal.component.scss'
})
export class AddReserveModalComponent {
  readonly data = inject<AddReserveModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AddReserveModalComponent, AddReserveResult | null>>(NxModalRef);

  readonly claim = this.data.claim;
  readonly typeOptions = RESERVE_TYPES.map(t => ({ value: t, label: RESERVE_TYPE_LABELS[t] }));
  readonly section = signal<ReserveSectionOption | null>(null);

  readonly form = new FormGroup({
    sectionKey: new FormControl<string | null>(null, Validators.required),
    partyId: new FormControl<string | null>({ value: null, disabled: true }, Validators.required),
    damage: new FormControl<string | null>({ value: null, disabled: true }, Validators.required),
    reserveType: new FormControl<ReserveType | null>(
      { value: null, disabled: true },
      Validators.required
    )
  });

  // Not form.valid: a disabled control does not count, so with no parties
  // the form would read as valid with Party still empty.
  get canProceed(): boolean {
    const v = this.form.getRawValue();
    return !!(v.sectionKey && v.partyId && v.damage && v.reserveType);
  }

  get noSections(): boolean {
    return this.claim.sections.length === 0;
  }
  get noParties(): boolean {
    return this.claim.parties.length === 0;
  }

  constructor() {
    if (this.noSections) this.form.controls.sectionKey.disable();
    if (this.claim.sections.length === 1) this.onSectionChange(this.claim.sections[0].key);
  }

  onSectionChange(key: string | null): void {
    const c = this.form.controls;
    c.sectionKey.setValue(key);
    this.section.set(this.claim.sections.find(s => s.key === key) ?? null);
    this.reset(c.partyId, !!key && !this.noParties);
    this.reset(c.damage, false);
    this.reset(c.reserveType, false);
    if (key && this.claim.parties.length === 1) this.onPartyChange(this.claim.parties[0].partyId);
  }

  onPartyChange(id: string | null): void {
    const c = this.form.controls;
    c.partyId.setValue(id);
    this.reset(c.damage, !!id);
    this.reset(c.reserveType, false);
    const entities = this.section()?.entities ?? [];
    if (id && entities.length === 1) this.onDamageChange(entities[0]);
  }

  onDamageChange(damage: string | null): void {
    const c = this.form.controls;
    c.damage.setValue(damage);
    this.reset(c.reserveType, !!damage);
  }

  private reset(ctrl: FormControl, enabled: boolean): void {
    ctrl.setValue(null);
    // A cleared choice is a fresh question, not a mistake: no error until Proceed.
    ctrl.markAsUntouched();
    if (enabled) ctrl.enable();
    else ctrl.disable();
  }

  onCancel(): void {
    this.modalRef.close(null);
  }

  onProceed(): void {
    if (!this.canProceed) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.modalRef.close({
      sectionKey: v.sectionKey!,
      partyId: v.partyId!,
      damage: v.damage!,
      reserveType: v.reserveType!
    });
  }
}
