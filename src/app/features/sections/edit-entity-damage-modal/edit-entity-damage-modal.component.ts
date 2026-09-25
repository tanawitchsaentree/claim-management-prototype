import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { SectionEntity, InstructionStatus } from '../../../core/models/section.model';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { LocationPickerOutput, formatLocationItem } from '../../../core/models';

export interface EditEntityDamageModalData {
  entity: SectionEntity;
  // Needed to decide whether the CBI Yes/No question is even askable —
  // without this, an entity that was never marked CBI had no way to ever
  // become CBI through editing (only brand-new entities, via
  // add-section-entity-modal, could get it) — found via self-review after
  // shipping cbi's search UX everywhere else, 2026-09-25.
  damageType: string;
}

// Damage type moved to the section (ClaimSection.damageType) in Stage 2 of
// the FNOL/claim-file model fix — an entity no longer carries its own damage
// value, so instruction status used to be the only thing left to edit here.
// CBI fields (BMPCC-18353) added back on 2026-09-18 — correcting a case
// type/third-party/location typo on an *already-captured* CBI entity is a
// plain patch on an existing record (MockSectionService.patchEntity()), not
// a re-run of the FNOL Loss Information confirmation flow. It doesn't touch
// the AiP re-fetch path that BMPCC-14960 blocks, so it's safe to build now.
// Originally scoped to "correct an existing CBI entity" only — widened
// 2026-09-25 to also let a business-interruption entity that was never
// marked CBI become one here (isContingentBi is explicitly included below
// so answering "No" can un-set a previously-true flag, not just leave it
// stale).
export type EditEntityDamageModalResult = Pick<
  SectionEntity,
  | 'instructionStatus'
  | 'isContingentBi'
  | 'cbiCaseType'
  | 'thirdPartyName'
  | 'thirdPartyRelationship'
  | 'thirdPartyIndustry'
  | 'cbiOriginatingLocation'
  | 'cbiOriginatingLocationDetail'
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
    NxIconModule,
    NxRadioModule,
    LocationPickerComponent
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

  // Whether the CBI question is askable AT ALL — a non-BI entity never gets
  // it, same gate as FNOL/add-section-entity-modal. Static: damageType lives
  // on the section, not this entity, and doesn't change within this modal.
  readonly isBusinessInterruption = this.data.damageType === 'business-interruption';
  readonly cbiCaseTypeOptions = this.lookupSvc.getCbiCaseTypesSync();

  readonly form = this.fb.group({
    instructionStatus: [this.data.entity.instructionStatus, Validators.required],
    // Seeded from the entity's current flag, not forced true/false — an
    // entity that was never asked starts unanswered (null), same as FNOL,
    // rather than defaulting to "No" and silently implying an answer that
    // was never actually given.
    cbiApplicable: [this.data.entity.isContingentBi ? 'yes' : (null as 'yes' | 'no' | null)],
    cbiCaseType: [this.data.entity.cbiCaseType ?? null],
    thirdPartyName: [this.data.entity.thirdPartyName ?? ''],
    thirdPartyIndustry: [this.data.entity.thirdPartyIndustry ?? '']
  });

  private readonly cbiApplicableSig = toSignal(this.form.get('cbiApplicable')!.valueChanges, {
    initialValue: this.form.value.cbiApplicable ?? null
  });
  readonly showCbiDetails = computed(() => this.cbiApplicableSig() === 'yes');

  // Same GIS-search-or-manual pattern as FNOL's cbiLocation (see
  // step-loss-information) — supersedes the brief free-text version (team
  // call, 2026-09-25, itself replacing a 7-field nested group). Seeded from
  // the structured pick if one exists; a pre-existing entity that only has
  // the legacy display string (no detail) starts empty and re-search is
  // required — there's nothing structured to rehydrate from a plain string.
  readonly cbiLocation = new FormControl<LocationPickerOutput>(
    {
      locations: this.data.entity.cbiOriginatingLocationDetail
        ? [this.data.entity.cbiOriginatingLocationDetail]
        : []
    },
    { nonNullable: true }
  );

  onCbiLocationChange(output: LocationPickerOutput): void {
    this.cbiLocation.setValue(output);
  }

  // LocationPickerComponent isn't a form control — no `.touched` to key the
  // "Required" error off. Set on a failed confirm() instead, same as
  // add-location-modal's manualSubmitted.
  submitted = false;

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

  get showThirdPartyIndustry(): boolean {
    return this.showThirdPartyName;
  }

  get thirdPartyIndustryLabel(): string {
    return this.selectedCbiCaseType?.startsWith('customer-')
      ? 'Customer industry (optional)'
      : 'Supplier industry (optional)';
  }

  onCbiCaseTypeChange(): void {
    if (!this.showThirdPartyName) {
      this.form.get('thirdPartyName')?.setValue('');
      this.form.get('thirdPartyIndustry')?.setValue('');
    }
  }

  private cbiRelationshipFor(cbiCaseType: string): 'supplier' | 'customer' | 'other' {
    if (cbiCaseType.startsWith('supplier-')) return 'supplier';
    if (cbiCaseType.startsWith('customer-')) return 'customer';
    return 'other';
  }

  confirm(): void {
    const missingCbiAnswer = this.isBusinessInterruption && !this.form.value.cbiApplicable;
    const missingCaseType = this.showCbiDetails() && !this.selectedCbiCaseType;
    const missingThirdParty =
      this.showCbiDetails() &&
      this.showThirdPartyName &&
      this.thirdPartyRequired &&
      !this.form.value.thirdPartyName;
    const missingLocation = this.showCbiDetails() && this.cbiLocation.value.locations.length === 0;

    if (
      this.form.get('instructionStatus')?.invalid ||
      missingCbiAnswer ||
      missingCaseType ||
      missingThirdParty ||
      missingLocation
    ) {
      this.form.markAllAsTouched();
      this.submitted = true;
      return;
    }

    const caseType = this.selectedCbiCaseType;
    const cbiLocationItem = this.cbiLocation.value.locations[0];

    this.modalRef.close({
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
      // isContingentBi is always sent explicitly (not just when true) — an
      // entity that WAS CBI and just got answered "No" needs its stale
      // case type/third-party/location actually cleared, not left behind.
      isContingentBi: this.showCbiDetails() && !!caseType,
      ...(this.showCbiDetails() && caseType
        ? {
            cbiCaseType: caseType,
            thirdPartyName: this.showThirdPartyName
              ? (this.form.value.thirdPartyName as string) || undefined
              : undefined,
            thirdPartyRelationship: this.cbiRelationshipFor(caseType),
            thirdPartyIndustry: this.showThirdPartyIndustry
              ? (this.form.value.thirdPartyIndustry as string) || undefined
              : undefined,
            cbiOriginatingLocation: cbiLocationItem ? formatLocationItem(cbiLocationItem) : undefined,
            cbiOriginatingLocationDetail: cbiLocationItem
          }
        : {
            cbiCaseType: undefined,
            thirdPartyName: undefined,
            thirdPartyRelationship: undefined,
            thirdPartyIndustry: undefined,
            cbiOriginatingLocation: undefined,
            cbiOriginatingLocationDetail: undefined
          })
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
