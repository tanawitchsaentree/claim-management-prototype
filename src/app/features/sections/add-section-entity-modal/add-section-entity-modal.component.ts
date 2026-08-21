import { Component, inject, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule, NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { damageOptionLabels, INSTRUCTION_STATUS_OPTIONS } from '../edit-entity-damage-modal/edit-entity-damage-modal.component';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
}

export interface AddSectionEntityModalResult {
  sectionId: string;
  instructionStatus: InstructionStatus;
  entities: { name: string; damage: string }[];
}

// Candidate entities per damage type — no such mapping existed in mock data
// (per Phase 2 item 2, point 7); invented for the demo, generic enough for
// any commercial-property claim. Not tied to any specific claim's fixtures.
const DAMAGE_TYPE_ENTITIES: Record<string, string[]> = {
  'Material damage':        ['Warehouse Racking', 'Loading Dock Doors', 'Roller Shutter Doors', 'Perimeter Fencing'],
  'Business interruption':  ['Production Line Downtime', 'Retail Storefront Closure', 'Distribution Center Closure'],
  'Machinery breakdown':    ['Conveyor System', 'HVAC Compressor Unit', 'Packaging Machine'],
  'Financial loss':         ['Lost Rental Income', 'Increased Cost of Working'],
  'Bodily injury':          ['Warehouse Staff Injury', 'Visitor Injury Claim'],
  'Liability':              ['Third-Party Property Damage', 'Public Liability Claim'],
};

@Component({
  selector: 'app-add-section-entity-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, NxModalModule, NxFormfieldModule,
    NxDropdownModule, NxMultiSelectComponent, NxCheckboxModule, NxButtonModule,
  ],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss',
})
export class AddSectionEntityModalComponent {
  readonly data     = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);

  readonly damageTypeOptions       = damageOptionLabels(this.lookupSvc).map(d => ({ value: d, label: d }));
  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;
  readonly openSections             = this.data.sections.filter(s => s.status === 'Open');
  readonly damageTypeEntities       = DAMAGE_TYPE_ENTITIES;

  submitAttempted = false;

  readonly form = this.fb.group({
    sectionId:         [this.openSections[0]?.id ?? '', Validators.required],
    damageTypes:       [[] as string[], Validators.required],
    instructionStatus: ['Not assigned' as InstructionStatus, Validators.required],
  });

  // damage type -> selected entity names, one independent group per type.
  readonly selected = signal<Record<string, Set<string>>>({});

  get selectedDamageTypes(): string[] {
    return (this.form.value.damageTypes as string[]) ?? [];
  }

  entitiesFor(damageType: string): string[] {
    return this.damageTypeEntities[damageType] ?? [];
  }

  isEntitySelected(damageType: string, entity: string): boolean {
    return this.selected()[damageType]?.has(entity) ?? false;
  }

  toggleEntity(damageType: string, entity: string): void {
    const next = { ...this.selected() };
    const set = new Set(next[damageType] ?? []);
    if (set.has(entity)) set.delete(entity); else set.add(entity);
    next[damageType] = set;
    this.selected.set(next);
  }

  readonly hasAnySelection = computed(() =>
    Object.values(this.selected()).some(set => set.size > 0),
  );

  confirm(): void {
    this.submitAttempted = true;
    if (this.form.get('sectionId')!.invalid || this.form.get('damageTypes')!.invalid || !this.hasAnySelection()) {
      this.form.markAllAsTouched();
      return;
    }
    const entities: { name: string; damage: string }[] = [];
    for (const [damage, names] of Object.entries(this.selected())) {
      for (const name of names) entities.push({ name, damage });
    }
    this.modalRef.close({
      sectionId:         this.form.value.sectionId!,
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
      entities,
    });
  }

  cancel(): void { this.modalRef.close(); }
}
