import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection, InstructionStatus } from '../../../core/models/section.model';
import { DAMAGE_OPTIONS, INSTRUCTION_STATUS_OPTIONS } from '../edit-entity-damage-modal/edit-entity-damage-modal.component';

export interface AddSectionEntityModalData {
  sections: ClaimSection[];
}

export interface AddSectionEntityModalResult {
  sectionId: string;
  name: string;
  damage: string;
  instructionStatus: InstructionStatus;
}

@Component({
  selector: 'app-add-section-entity-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './add-section-entity-modal.component.html',
  styleUrl: './add-section-entity-modal.component.scss',
})
export class AddSectionEntityModalComponent {
  readonly data     = inject<AddSectionEntityModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddSectionEntityModalComponent, AddSectionEntityModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly damageOptions            = DAMAGE_OPTIONS;
  readonly instructionStatusOptions = INSTRUCTION_STATUS_OPTIONS;
  readonly openSections             = this.data.sections.filter(s => s.status === 'Open');

  readonly form = this.fb.group({
    sectionId:         [this.openSections[0]?.id ?? '', Validators.required],
    name:              ['', Validators.required],
    damage:            ['', Validators.required],
    instructionStatus: ['Not assigned' as InstructionStatus, Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.modalRef.close({
      sectionId:         this.form.value.sectionId!,
      name:              this.form.value.name!,
      damage:            this.form.value.damage!,
      instructionStatus: this.form.value.instructionStatus as InstructionStatus,
    });
  }

  cancel(): void { this.modalRef.close(); }
}
