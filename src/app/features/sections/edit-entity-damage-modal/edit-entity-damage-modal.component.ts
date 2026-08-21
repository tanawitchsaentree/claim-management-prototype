import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { SectionEntity, InstructionStatus } from '../../../core/models/section.model';

export interface EditEntityDamageModalData {
  entity: SectionEntity;
}

// Damage type moved to the section (ClaimSection.damageType) in Stage 2 of
// the FNOL/claim-file model fix — an entity no longer carries its own damage
// value, so there's nothing left to edit here but instruction status.
// Component/file name kept as-is to avoid churning every import site for a
// rename; the "damage" in the name is now historical.
export type EditEntityDamageModalResult = Pick<SectionEntity, 'instructionStatus'>;

export const INSTRUCTION_STATUS_OPTIONS: InstructionStatus[] = [
  'Pending',
  'Not assigned',
  'In progress',
  'Completed',
];

@Component({
  selector: 'app-edit-entity-damage-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
  ],
  templateUrl: './edit-entity-damage-modal.component.html',
  styleUrl:    './edit-entity-damage-modal.component.scss',
})
export class EditEntityDamageModalComponent {
  readonly data      = inject<EditEntityDamageModalData>(NX_MODAL_DATA);
  readonly modalRef  = inject<NxModalRef<EditEntityDamageModalComponent, EditEntityDamageModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;

  readonly form = this.fb.group({
    instructionStatus: [this.data.entity.instructionStatus, Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close({
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
