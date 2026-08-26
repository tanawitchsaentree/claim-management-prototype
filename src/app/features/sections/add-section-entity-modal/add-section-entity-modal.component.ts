import { Component, inject, signal, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule, NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { EntitySearchResult } from '../../../core/models/entity-damage.model';
import { INSTRUCTION_STATUS_OPTIONS } from '../edit-entity-damage-modal/edit-entity-damage-modal.component';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockEntitySearchService } from '../../../core/mock/services/mock-entity-search.service';
import { DAMAGE_TYPE_TO_ENTITY_TYPES } from '../../fnol/config/entity-damage-mapping';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
  claimId: string;
  policyNumber: string;
}

interface InterruptionDates {
  interruptionStartDate?: string;
  interruptionEndDate?:   string;
}

export type AddSectionEntityModalResult =
  | ({ mode: 'existing'; sectionId: string; instructionStatus: InstructionStatus; entityNames: string[] } & InterruptionDates)
  | ({ mode: 'new'; damageType: string; instructionStatus: InstructionStatus; entityNames: string[] } & InterruptionDates);

@Component({
  selector: 'app-add-section-entity-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, NxModalModule, NxFormfieldModule,
    NxDropdownModule, NxMultiSelectComponent, NxInputModule, NxDatefieldModule, NxButtonModule,
  ],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss',
})
export class AddSectionEntityModalComponent {
  readonly data     = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb        = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly entitySvc = inject(MockEntitySearchService);

  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;
  readonly damageTypeOptions = this.lookupSvc.getTypeOfDamageSync();

  submitAttempted = false;

  readonly candidateEntities = signal<EntitySearchResult[]>([]);
  readonly loadingCandidates = signal(false);

  readonly form = this.fb.group({
    damageType:            ['', Validators.required],
    entityIds:             [[] as string[]],
    instructionStatus:     ['Not assigned' as InstructionStatus, Validators.required],
    // No cross-field-conditional Validators.required here — this control is
    // only ever rendered when isBusinessInterruption() is true, so an
    // always-required validator can't wrongly block other damage types
    // (confirm() never checks form.invalid as a whole, only specific
    // controls). Required-ness is enforced by hand in confirm() instead;
    // this validator exists solely so nx-formfield's own invalid/touched
    // styling activates once markAllAsTouched() runs on a failed submit.
    interruptionStartDate: [null as string | null, Validators.required],
    interruptionEndDate:   [null as string | null],
  });

  private readonly damageTypeSigRaw = toSignal(this.form.get('damageType')!.valueChanges, {
    initialValue: this.form.value.damageType ?? '',
  });
  readonly damageTypeSig = computed(() => this.damageTypeSigRaw() ?? '');

  private readonly entityIdsSigRaw = toSignal(this.form.get('entityIds')!.valueChanges, {
    initialValue: this.form.value.entityIds ?? [],
  });
  readonly entityIdsSig = computed(() => this.entityIdsSigRaw() ?? []);
  readonly hasAnySelection = computed(() => this.entityIdsSig().length > 0);

  readonly damageTypeLabel = computed(() =>
    this.damageTypeOptions.find(o => o.value === this.damageTypeSig())?.label ?? '');

  // A damage type routes to its existing OPEN section if one exists —
  // otherwise (never had one, or only a closed one) it creates a new
  // section. Closed sections are never reused as add-targets.
  readonly isNewSection = computed(() =>
    !this.data.sections.some(s => s.damageType === this.damageTypeSig() && s.status === 'Open'));

  readonly entityOptions = computed(() =>
    this.candidateEntities().map(e => ({ value: e.propertyId, label: e.locationName })));

  readonly isBusinessInterruption = computed(() => this.damageTypeSig() === 'business-interruption');

  constructor() {
    effect(() => {
      const key = this.damageTypeSig();
      this.form.get('entityIds')!.setValue([], { emitEvent: false });
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
          firstValueFrom(this.entitySvc.search(this.data.policyNumber, type, {}))),
      );
      this.candidateEntities.set(results.flat());
    } finally {
      this.loadingCandidates.set(false);
    }
  }

  confirm(): void {
    const missingStartDate = this.isBusinessInterruption() && !this.form.value.interruptionStartDate;
    if (this.form.get('damageType')!.invalid || !this.hasAnySelection() || missingStartDate) {
      this.submitAttempted = true;
      this.form.markAllAsTouched();
      return;
    }
    const instructionStatus = this.form.value.instructionStatus as InstructionStatus;
    const selectedIds = new Set(this.entityIdsSig());
    const entityNames = this.candidateEntities()
      .filter(e => selectedIds.has(e.propertyId))
      .map(e => e.locationName);

    const interruptionDates: InterruptionDates = this.isBusinessInterruption()
      ? {
          interruptionStartDate: this.form.value.interruptionStartDate ?? undefined,
          interruptionEndDate:   this.form.value.interruptionEndDate ?? undefined,
        }
      : {};

    const damageType = this.damageTypeSig();
    const existing = this.data.sections.find(s => s.damageType === damageType && s.status === 'Open');

    if (existing) {
      this.modalRef.close({ mode: 'existing', sectionId: existing.id, instructionStatus, entityNames, ...interruptionDates });
      return;
    }
    this.modalRef.close({ mode: 'new', damageType, instructionStatus, entityNames, ...interruptionDates });
  }

  cancel(): void { this.modalRef.close(); }
}
