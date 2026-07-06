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

export type EditEntityDamageModalResult = Pick<SectionEntity, 'damage' | 'instructionStatus'>;

export const DAMAGE_OPTIONS: string[] = [
  'Material damage',
  'Business interruption',
  'Machinery breakdown',
  'Financial loss',
  'Bodily injury',
  'Liability',
];

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

  readonly damageOptions          = DAMAGE_OPTIONS;
  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;

  readonly form = this.fb.group({
    damage:            [this.data.entity.damage,            Validators.required],
    instructionStatus: [this.data.entity.instructionStatus, Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close({
      damage:            this.form.value.damage!,
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
    });
  }

  cancel(): void {
    this.modalRef.close();
  }
}
