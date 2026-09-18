import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import {
  SectionEntity,
  InstructionStatus,
  CbiOriginatingLocation
} from '../../../core/models/section.model';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

export interface EditEntityDamageModalData {
  entity: SectionEntity;
}

// Damage type moved to the section (ClaimSection.damageType) in Stage 2 of
// the FNOL/claim-file model fix — an entity no longer carries its own damage
// value, so instruction status used to be the only thing left to edit here.
// CBI fields (BMPCC-18353) added back on 2026-09-18 — correcting a case
// type/third-party/location typo on an *already-captured* CBI entity is a
// plain patch on an existing record (MockSectionService.patchEntity()), not
// a re-run of the FNOL Loss Information confirmation flow. It doesn't touch
// the AiP re-fetch path that BMPCC-14960 blocks, so it's safe to build now —
// adding CBI to a claim that never had it is a different, still-blocked
// problem (no entities for most policies' damage types — see CONVERSIONS.md).
export type EditEntityDamageModalResult = Pick<
  SectionEntity,
  | 'instructionStatus'
  | 'cbiCaseType'
  | 'thirdPartyName'
  | 'thirdPartyRelationship'
  | 'cbiOriginatingLocation'
>;

export const INSTRUCTION_STATUS_OPTIONS: InstructionStatus[] = [
  'Pending',
  'Not assigned',
  'In progress',
  'Completed'
];

@Component({
  selector: 'app-edit-entity-damage-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './edit-entity-damage-modal.component.html',
  styleUrl: './edit-entity-damage-modal.component.scss'
})
export class EditEntityDamageModalComponent {
  readonly data = inject<EditEntityDamageModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<EditEntityDamageModalComponent, EditEntityDamageModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);

  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;

  // Static for the modal's lifetime — whether this entity is CBI at all
  // never changes here (that's decided at FNOL, see step-loss-information).
  readonly isContingentBi = !!this.data.entity.isContingentBi;
  readonly cbiCaseTypeOptions = this.lookupSvc.getCbiCaseTypesSync();
  readonly countryOptions = this.lookupSvc.getCountriesSync();

  readonly form = this.fb.group({
    instructionStatus: [this.data.entity.instructionStatus, Validators.required],
    cbiCaseType: [this.data.entity.cbiCaseType ?? null],
    thirdPartyName: [this.data.entity.thirdPartyName ?? ''],
    cbiLocation: this.fb.group({
      country: [this.data.entity.cbiOriginatingLocation?.country ?? null],
      city: [this.data.entity.cbiOriginatingLocation?.city ?? ''],
      zip: [this.data.entity.cbiOriginatingLocation?.zip ?? ''],
      street: [this.data.entity.cbiOriginatingLocation?.street ?? ''],
      houseNumber: [this.data.entity.cbiOriginatingLocation?.houseNumber ?? ''],
      landRecordNumber: [this.data.entity.cbiOriginatingLocation?.landRecordNumber ?? ''],
      state: [this.data.entity.cbiOriginatingLocation?.state ?? '']
    })
  });

  get cbiLocationGroup() {
    return this.form.get('cbiLocation') as ReturnType<FormBuilder['group']>;
  }

  get selectedCbiCaseType(): string | null {
    return (this.form.get('cbiCaseType')?.value as string | null) ?? null;
  }

  // Same rule as FNOL capture (step-loss-information) — only supplier-/
  // customer- case types have an actual third party to name.
  get showThirdPartyName(): boolean {
    const key = this.selectedCbiCaseType;
    return !!key && (key.startsWith('supplier-') || key.startsWith('customer-'));
  }

  // Same ASSUMPTION [CBI-FNOL-3] as FNOL — only "-named" variants require a
  // name; "-unnamed" offers the field but doesn't block on it.
  get thirdPartyRequired(): boolean {
    return !!this.selectedCbiCaseType?.endsWith('-named');
  }

  get thirdPartyLabel(): string {
    const base = this.selectedCbiCaseType?.startsWith('customer-')
      ? 'Customer name'
      : 'Supplier name';
    return this.thirdPartyRequired ? base : `${base} (optional)`;
  }

  onCbiCaseTypeChange(): void {
    if (!this.showThirdPartyName) {
      this.form.get('thirdPartyName')?.setValue('');
    }
  }

  private cbiRelationshipFor(cbiCaseType: string): 'supplier' | 'customer' | 'other' {
    if (cbiCaseType.startsWith('supplier-')) return 'supplier';
    if (cbiCaseType.startsWith('customer-')) return 'customer';
    return 'other';
  }

  confirm(): void {
    const missingCaseType = this.isContingentBi && !this.selectedCbiCaseType;
    const missingThirdParty =
      this.isContingentBi &&
      this.showThirdPartyName &&
      this.thirdPartyRequired &&
      !this.form.value.thirdPartyName;
    const loc = this.cbiLocationGroup.value as {
      country: string | null;
      city: string;
      zip: string;
    };
    const missingLocation =
      this.isContingentBi && (!loc.country || !loc.city || !loc.zip);

    if (this.form.get('instructionStatus')?.invalid || missingCaseType || missingThirdParty || missingLocation) {
      this.form.markAllAsTouched();
      return;
    }

    const caseType = this.selectedCbiCaseType;
    const locationValue = this.cbiLocationGroup.value as CbiOriginatingLocation;

    this.modalRef.close({
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
      ...(this.isContingentBi && caseType
        ? {
            cbiCaseType: caseType,
            thirdPartyName: this.showThirdPartyName
              ? (this.form.value.thirdPartyName as string) || undefined
              : undefined,
            thirdPartyRelationship: this.cbiRelationshipFor(caseType),
            cbiOriginatingLocation: {
              country: locationValue.country ?? '',
              city: locationValue.city ?? '',
              zip: locationValue.zip ?? '',
              street: locationValue.street || undefined,
              houseNumber: locationValue.houseNumber || undefined,
              landRecordNumber: locationValue.landRecordNumber || undefined,
              state: locationValue.state || undefined
            }
          }
        : {})
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
