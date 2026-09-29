import { Component, inject, signal, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule, NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { EntitySearchResult } from '../../../core/models/entity-damage.model';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockEntitySearchService } from '../../../core/mock/services/mock-entity-search.service';
import { DAMAGE_TYPE_TO_ENTITY_TYPES } from '../../fnol/config/entity-damage-mapping';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { LocationPickerOutput, LocationItem, formatLocationItem } from '../../../core/models';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
  claimId: string;
  policyNumber: string;
}

// dateOfOccurrence applies to every damage type (entities in the same
// section can be added at different times / from different events).
// Interruption dates are only meaningful when damageType is
// 'business-interruption'.
//
// CBI capture (case type, third-party, originating location) now lives
// here too — this is the "add CBI to a claim that never had it" surface
// that was explicitly out of scope until BMPCC-14960 (Edit Claim AiP
// isolation) resolved; same question set as FNOL Loss Information
// (step-loss-information) and edit-entity-damage-modal (post-capture
// correction), applied identically to every entity selected in this one
// add action — CBI is a property of the business-interruption damage
// type being added, not chosen per-entity within a single add.
interface EntityExtras {
  dateOfOccurrence?: string;
  interruptionStartDate?: string;
  interruptionEndDate?: string;
  isContingentBi?: boolean;
  cbiCaseType?: string;
  thirdPartyName?: string;
  thirdPartyRelationship?: 'supplier' | 'customer' | 'other';
  thirdPartyIndustry?: string;
  cbiOriginatingLocation?: string;
  cbiOriginatingLocationDetail?: LocationItem;
}

export type AddSectionEntityModalResult =
  | ({
      mode: 'existing';
      sectionId: string;
      instructionStatus: InstructionStatus;
      entityNames: string[];
    } & EntityExtras)
  | ({
      mode: 'new';
      damageType: string;
      instructionStatus: InstructionStatus;
      entityNames: string[];
    } & EntityExtras);

@Component({
  selector: 'app-add-section-entity-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxMultiSelectComponent,
    NxInputModule,
    NxDatefieldModule,
    NxButtonModule,
    NxRadioModule,
    LocationPickerComponent
  ],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss'
})
export class AddSectionEntityModalComponent {
  readonly data = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly entitySvc = inject(MockEntitySearchService);

  readonly damageTypeOptions = this.lookupSvc.getTypeOfDamageSync();

  submitAttempted = false;

  readonly candidateEntities = signal<EntitySearchResult[]>([]);
  readonly loadingCandidates = signal(false);

  readonly form = this.fb.group({
    damageType: ['', Validators.required],
    entityIds: [[] as string[]],
    // Replaces instructionStatus (Marlene feedback, 2026-08-31) — instruction
    // status can be set later via Edit Entity; asking for it at add-time
    // forced a decision before there was anything to base it on.
    dateOfOccurrence: [null as string | null, Validators.required],
    // No cross-field-conditional Validators.required here — this control is
    // only ever rendered when isBusinessInterruption() is true, so an
    // always-required validator can't wrongly block other damage types
    // (confirm() never checks form.invalid as a whole, only specific
    // controls). Required-ness is enforced by hand in confirm() instead;
    // this validator exists solely so nx-formfield's own invalid/touched
    // styling activates once markAllAsTouched() runs on a failed submit.
    interruptionStartDate: [null as string | null, Validators.required],
    interruptionEndDate: [null as string | null],
    cbiApplicable: [null as 'yes' | 'no' | null],
    cbiCaseType: [null as string | null],
    cbiThirdPartyName: [''],
    cbiThirdPartyIndustry: ['']
  });

  // Same GIS-search-or-manual pattern as FNOL's cbiLocation.
  readonly cbiLocation = new FormControl<LocationPickerOutput>(
    { locations: [] },
    { nonNullable: true }
  );
  onCbiLocationChange(output: LocationPickerOutput): void {
    this.cbiLocation.setValue(output);
  }

  readonly cbiCaseTypeOptions = this.lookupSvc.getCbiCaseTypesSync();

  private readonly cbiApplicableSig = toSignal(this.form.get('cbiApplicable')!.valueChanges, {
    initialValue: this.form.value.cbiApplicable ?? null
  });
  private readonly cbiCaseTypeSigRaw = toSignal(this.form.get('cbiCaseType')!.valueChanges, {
    initialValue: this.form.value.cbiCaseType ?? null
  });
  readonly selectedCbiCaseType = computed(() => this.cbiCaseTypeSigRaw() ?? null);
  readonly showCbiDetails = computed(() => this.cbiApplicableSig() === 'yes');

  // Same rule as FNOL capture (step-loss-information) — only supplier-/
  // customer- case types have an actual third party to name.
  readonly showThirdPartyName = computed(() => {
    const key = this.selectedCbiCaseType();
    return !!key && (key.startsWith('supplier-') || key.startsWith('customer-'));
  });
  readonly thirdPartyRequired = computed(() => !!this.selectedCbiCaseType()?.endsWith('-named'));
  readonly thirdPartyLabel = computed(() => {
    const base = this.selectedCbiCaseType()?.startsWith('customer-')
      ? 'Customer name'
      : 'Supplier name';
    return this.thirdPartyRequired() ? base : `${base} (optional)`;
  });
  readonly showThirdPartyIndustry = this.showThirdPartyName;
  readonly thirdPartyIndustryLabel = computed(() =>
    this.selectedCbiCaseType()?.startsWith('customer-')
      ? 'Customer industry (optional)'
      : 'Supplier industry (optional)'
  );

  onCbiCaseTypeChange(): void {
    if (!this.showThirdPartyName()) {
      this.form.get('cbiThirdPartyName')?.setValue('');
      this.form.get('cbiThirdPartyIndustry')?.setValue('');
    }
  }

  private cbiRelationshipFor(cbiCaseType: string): 'supplier' | 'customer' | 'other' {
    if (cbiCaseType.startsWith('supplier-')) return 'supplier';
    if (cbiCaseType.startsWith('customer-')) return 'customer';
    return 'other';
  }

  private readonly damageTypeSigRaw = toSignal(this.form.get('damageType')!.valueChanges, {
    initialValue: this.form.value.damageType ?? ''
  });
  readonly damageTypeSig = computed(() => this.damageTypeSigRaw() ?? '');

  private readonly entityIdsSigRaw = toSignal(this.form.get('entityIds')!.valueChanges, {
    initialValue: this.form.value.entityIds ?? []
  });
  readonly entityIdsSig = computed(() => this.entityIdsSigRaw() ?? []);
  readonly hasAnySelection = computed(() => this.entityIdsSig().length > 0);

  readonly damageTypeLabel = computed(
    () => this.damageTypeOptions.find(o => o.value === this.damageTypeSig())?.label ?? ''
  );

  // A damage type routes to its existing OPEN section if one exists —
  // otherwise (never had one, or only a closed one) it creates a new
  // section. Closed sections are never reused as add-targets.
  readonly isNewSection = computed(
    () =>
      !this.data.sections.some(s => s.damageType === this.damageTypeSig() && s.status === 'Open')
  );

  readonly entityOptions = computed(() =>
    this.candidateEntities().map(e => ({ value: e.propertyId, label: e.locationName }))
  );

  readonly isBusinessInterruption = computed(
    () => this.damageTypeSig() === 'business-interruption'
  );

  constructor() {
    effect(() => {
      const key = this.damageTypeSig();
      this.form.get('entityIds')!.setValue([], { emitEvent: false });
      if (key !== 'business-interruption') {
        this.form.get('cbiApplicable')?.setValue(null, { emitEvent: false });
        this.form.get('cbiCaseType')?.setValue(null, { emitEvent: false });
        this.form.get('cbiThirdPartyName')?.setValue('', { emitEvent: false });
        this.form.get('cbiThirdPartyIndustry')?.setValue('', { emitEvent: false });
        this.cbiLocation.setValue({ locations: [] }, { emitEvent: false });
      }
      if (!key) {
        this.candidateEntities.set([]);
        return;
      }
      this.loadCandidatesFor(key);
    });
  }

  private async loadCandidatesFor(damageTypeKey: string): Promise<void> {
    this.loadingCandidates.set(true);
    const entityTypes = DAMAGE_TYPE_TO_ENTITY_TYPES[damageTypeKey] ?? [];
    try {
      const results = await Promise.all(
        entityTypes.map(type =>
          firstValueFrom(this.entitySvc.search(this.data.policyNumber, type, {}))
        )
      );
      this.candidateEntities.set(results.flat());
    } finally {
      this.loadingCandidates.set(false);
    }
  }

  confirm(): void {
    const missingDateOfOccurrence = !this.form.value.dateOfOccurrence;
    const missingStartDate =
      this.isBusinessInterruption() && !this.form.value.interruptionStartDate;
    const missingCbiAnswer = this.isBusinessInterruption() && !this.form.value.cbiApplicable;
    const missingCbiCaseType = this.showCbiDetails() && !this.selectedCbiCaseType();
    const missingCbiThirdParty =
      this.showCbiDetails() &&
      this.showThirdPartyName() &&
      this.thirdPartyRequired() &&
      !this.form.value.cbiThirdPartyName;
    const missingCbiLocation = this.showCbiDetails() && this.cbiLocation.value.locations.length === 0;
    if (
      this.form.get('damageType')!.invalid ||
      !this.hasAnySelection() ||
      missingDateOfOccurrence ||
      missingStartDate ||
      missingCbiAnswer ||
      missingCbiCaseType ||
      missingCbiThirdParty ||
      missingCbiLocation
    ) {
      this.submitAttempted = true;
      this.form.markAllAsTouched();
      return;
    }
    // Instruction status is no longer asked at add-time (Marlene feedback,
    // 2026-08-31) — every new entity starts 'Not assigned' and gets its real
    // status set afterward via Edit Entity, same as before this field existed.
    const instructionStatus: InstructionStatus = 'Not assigned';
    const selectedIds = new Set(this.entityIdsSig());
    const entityNames = this.candidateEntities()
      .filter(e => selectedIds.has(e.propertyId))
      .map(e => e.locationName);

    const caseType = this.selectedCbiCaseType();
    const isCbi = this.showCbiDetails() && !!caseType;
    const cbiLocationItem = this.cbiLocation.value.locations[0];

    const entityExtras: EntityExtras = {
      dateOfOccurrence: this.form.value.dateOfOccurrence ?? undefined,
      ...(this.isBusinessInterruption()
        ? {
            interruptionStartDate: this.form.value.interruptionStartDate ?? undefined,
            interruptionEndDate: this.form.value.interruptionEndDate ?? undefined
          }
        : {}),
      ...(isCbi
        ? {
            isContingentBi: true,
            cbiCaseType: caseType!,
            thirdPartyName: this.showThirdPartyName()
              ? (this.form.value.cbiThirdPartyName as string) || undefined
              : undefined,
            thirdPartyRelationship: this.cbiRelationshipFor(caseType!),
            thirdPartyIndustry: this.showThirdPartyIndustry()
              ? (this.form.value.cbiThirdPartyIndustry as string) || undefined
              : undefined,
            cbiOriginatingLocation: cbiLocationItem ? formatLocationItem(cbiLocationItem) : undefined,
            cbiOriginatingLocationDetail: cbiLocationItem
          }
        : {})
    };

    const damageType = this.damageTypeSig();
    const existing = this.data.sections.find(
      s => s.damageType === damageType && s.status === 'Open'
    );

    if (existing) {
      this.modalRef.close({
        mode: 'existing',
        sectionId: existing.id,
        instructionStatus,
        entityNames,
        ...entityExtras
      });
      return;
    }
    this.modalRef.close({
      mode: 'new',
      damageType,
      instructionStatus,
      entityNames,
      ...entityExtras
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
