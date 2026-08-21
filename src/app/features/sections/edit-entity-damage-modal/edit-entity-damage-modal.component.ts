import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { SectionEntity, InstructionStatus } from '../../../core/models/section.model';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

export interface EditEntityDamageModalData {
  entity: SectionEntity;
}

export type EditEntityDamageModalResult = Pick<SectionEntity, 'damage' | 'instructionStatus'>;

// Stage 1 of the FNOL/claim-file damage-type consolidation: sourced from
// lookups.json (MockLookupService) instead of a hardcoded literal — same
// vocabulary FNOL step 1/2 now use. Stage 2 removes damage editing from this
// modal entirely (damage type moves to the section), so this export is
// transitional and consumed one more time by add-section-entity-modal until
// that stage lands.
export function damageOptionLabels(lookupSvc: MockLookupService): string[] {
  return lookupSvc.getTypeOfDamageSync().map(o => o.label);
}

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
  private readonly lookupSvc = inject(MockLookupService);

  readonly damageOptions          = damageOptionLabels(this.lookupSvc);
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
