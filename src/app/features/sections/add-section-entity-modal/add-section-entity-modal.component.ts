import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { INSTRUCTION_STATUS_OPTIONS } from '../edit-entity-damage-modal/edit-entity-damage-modal.component';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
}

export interface AddSectionEntityModalResult {
  sectionId: string;
  instructionStatus: InstructionStatus;
  entityNames: string[];
}

// Candidate entities per damage type — no such mapping existed in mock data
// (per Phase 2 item 2, point 7); invented for the demo, generic enough for
// any commercial-property claim. Not tied to any specific claim's fixtures.
// Replaced in Stage 8 of the FNOL/claim-file model fix with entities sourced
// from MockEntitySearchService (the same place FNOL sources them) — kept here
// only as the label-keyed candidate list this Stage-2 pass still reads.
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
    NxDropdownModule, NxCheckboxModule, NxButtonModule,
  ],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss',
})
export class AddSectionEntityModalComponent {
  readonly data     = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly lookupSvc = inject(MockLookupService);

  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;
  readonly openSections             = this.data.sections.filter(s => s.status === 'Open');
  readonly damageTypeEntities       = DAMAGE_TYPE_ENTITIES;

  submitAttempted = false;

  readonly form = this.fb.group({
    sectionId:         [this.openSections[0]?.id ?? '', Validators.required],
    instructionStatus: ['Not assigned' as InstructionStatus, Validators.required],
  });

  // A section owns one damage type — adding entities to it means adding under
  // that same type, not choosing a new one (choosing a type is what creating
  // a new section is for, see Stage 8's "Add damage type" action instead).
  private readonly sectionIdSig = toSignal(this.form.get('sectionId')!.valueChanges, {
    initialValue: this.form.value.sectionId ?? '',
  });

  readonly selectedSection = computed(() =>
    this.openSections.find(s => s.id === this.sectionIdSig()) ?? null,
  );

  readonly damageTypeLabel = computed(() => {
    const key = this.selectedSection()?.damageType;
    if (!key) return '';
    return this.lookupSvc.getTypeOfDamageSync().find(o => o.value === key)?.label ?? key;
  });

  readonly candidateEntities = computed(() => this.damageTypeEntities[this.damageTypeLabel()] ?? []);

  // Selected entity names for the section's single damage type.
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
    if (this.form.get('sectionId')!.invalid || !this.hasAnySelection()) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close({
      sectionId:         this.form.value.sectionId!,
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
      entityNames:       [...this.selected()],
    });
  }

  cancel(): void { this.modalRef.close(); }
}
