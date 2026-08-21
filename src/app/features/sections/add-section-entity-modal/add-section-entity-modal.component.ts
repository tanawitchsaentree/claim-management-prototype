import { Component, inject, signal, computed, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { EntityType } from '../../../core/models/entity-damage.model';
import { INSTRUCTION_STATUS_OPTIONS } from '../edit-entity-damage-modal/edit-entity-damage-modal.component';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockEntitySearchService } from '../../../core/mock/services/mock-entity-search.service';
import { ENTITY_TYPE_TO_DAMAGE_GROUP } from '../../../features/fnol/config/entity-damage-mapping';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
  claimId: string;
  policyNumber: string;
  // Stage 8: opened from the "Add damage type" action — default the
  // dropdown to a "create new section" option instead of an existing one.
  // Same modal, same interaction as "Add Entity"; only the default differs.
  preferNew?: boolean;
}

export type AddSectionEntityModalResult =
  | { mode: 'existing'; sectionId: string; instructionStatus: InstructionStatus; entityNames: string[] }
  | { mode: 'new'; damageType: string; instructionStatus: InstructionStatus; entityNames: string[] };

const NEW_PREFIX = 'NEW:';

// Reverses ENTITY_TYPE_TO_DAMAGE_GROUP so a chosen damage type resolves back
// to the entity types MockEntitySearchService can look up — the same
// sourcing FNOL step 2 uses for "add entity" (EntitySearchModalComponent),
// replacing the DAMAGE_TYPE_ENTITIES demo map this modal used to invent.
function entityTypesForDamageType(damageType: string): EntityType[] {
  return (Object.entries(ENTITY_TYPE_TO_DAMAGE_GROUP) as [EntityType, { damageTypeKey: string }][])
    .filter(([, route]) => route.damageTypeKey === damageType)
    .map(([entityType]) => entityType);
}

@Component({
  selector: 'app-add-section-entity-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, NxModalModule, NxFormfieldModule,
    NxDropdownModule, NxCheckboxModule, NxButtonModule,
  ],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss',
})
export class AddSectionEntityModalComponent {
  readonly data     = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly lookupSvc      = inject(MockLookupService);
  private readonly entitySearchSvc = inject(MockEntitySearchService);

  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;
  readonly openSections = this.data.sections.filter(s => s.status === 'Open');

  // Damage types with no section on this claim yet — the only ones a new
  // section can be created for (Section = Entity x DamageType; a type that
  // already has a section gets entities added to it instead, not a
  // duplicate section of the same type).
  private readonly usedDamageTypes = new Set(this.data.sections.map(s => s.damageType));
  readonly availableNewDamageTypes = this.lookupSvc.getTypeOfDamageSync()
    .filter(o => !this.usedDamageTypes.has(o.value));

  readonly targetOptions = [
    ...this.openSections.map(s => ({ value: s.id, label: s.name })),
    ...this.availableNewDamageTypes.map(o => ({ value: `${NEW_PREFIX}${o.value}`, label: `+ New section — ${o.label}` })),
  ];

  private readonly defaultTargetValue = (): string => {
    if (this.data.preferNew && this.availableNewDamageTypes.length) {
      return `${NEW_PREFIX}${this.availableNewDamageTypes[0].value}`;
    }
    return this.openSections[0]?.id ?? this.targetOptions[0]?.value ?? '';
  };

  submitAttempted = false;

  readonly form = this.fb.group({
    target:            [this.defaultTargetValue(), Validators.required],
    instructionStatus: ['Not assigned' as InstructionStatus, Validators.required],
  });

  private readonly targetSigRaw = toSignal(this.form.get('target')!.valueChanges, {
    initialValue: this.form.value.target ?? '',
  });
  readonly targetSig = computed(() => this.targetSigRaw() ?? '');

  readonly isNewSection = computed(() => this.targetSig().startsWith(NEW_PREFIX));

  readonly damageTypeKey = computed(() => {
    const value = this.targetSig();
    if (value.startsWith(NEW_PREFIX)) return value.slice(NEW_PREFIX.length);
    return this.openSections.find(s => s.id === value)?.damageType ?? '';
  });

  readonly damageTypeLabel = computed(() => {
    const key = this.damageTypeKey();
    if (!key) return '';
    return this.lookupSvc.getTypeOfDamageSync().find(o => o.value === key)?.label ?? key;
  });

  readonly candidateEntities = signal<string[]>([]);
  readonly loadingCandidates = signal(false);

  constructor() {
    effect(() => {
      const key = this.damageTypeKey();
      if (!key) { this.candidateEntities.set([]); return; }
      this.loadCandidatesFor(key);
    });
  }

  private async loadCandidatesFor(damageType: string): Promise<void> {
    this.loadingCandidates.set(true);
    const entityTypes = entityTypesForDamageType(damageType);
    const results = await Promise.all(
      entityTypes.map(t => firstValueFrom(this.entitySearchSvc.search(this.data.policyNumber, t, {}))),
    );
    const names = [...new Set(results.flat().map(r => r.locationName))];
    this.candidateEntities.set(names);
    this.loadingCandidates.set(false);
  }

  readonly selected = signal<Set<string>>(new Set());

  isEntitySelected(entity: string): boolean {
    return this.selected().has(entity);
  }

  toggleEntity(entity: string): void {
    const set = new Set(this.selected());
    if (set.has(entity)) set.delete(entity); else set.add(entity);
    this.selected.set(set);
  }

  readonly hasAnySelection = computed(() => this.selected().size > 0);

  confirm(): void {
    this.submitAttempted = true;
    if (this.form.get('target')!.invalid || !this.hasAnySelection()) {
      this.form.markAllAsTouched();
      return;
    }
    const instructionStatus = this.form.value.instructionStatus as InstructionStatus;
    const entityNames = [...this.selected()];

    if (this.isNewSection()) {
      this.modalRef.close({ mode: 'new', damageType: this.damageTypeKey(), instructionStatus, entityNames });
      return;
    }
    this.modalRef.close({ mode: 'existing', sectionId: this.targetSig(), instructionStatus, entityNames });
  }

  cancel(): void { this.modalRef.close(); }
}
