import { Component, inject } from '@angular/core';

import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { ClaimSection } from '../../../../../core/models/section.model';
import { ProviderAssignment, ProviderType } from '../../../../../core/models/provider-assignment.model';

export interface AssignProviderModalData {
  claimId: string;
  sections: ClaimSection[];
  preselectedSectionId?: string | null;
}

export type AssignProviderModalResult = Omit<ProviderAssignment, 'assignmentId'>;

const PROVIDER_TYPE_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: 'adjuster', label: 'Adjuster' },
  { value: 'legal', label: 'Legal' },
  { value: 'expert', label: 'Expert' },
  { value: 'other', label: 'Other' }
];

@Component({
  selector: 'app-assign-provider-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxDatefieldModule
  ],
  templateUrl: './assign-provider-modal.component.html',
  styleUrl: './assign-provider-modal.component.scss'
})
export class AssignProviderModalComponent {
  readonly data = inject<AssignProviderModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AssignProviderModalComponent, AssignProviderModalResult | null>>(NxModalRef);

  readonly providerTypeOptions = PROVIDER_TYPE_OPTIONS;
  submitted = false;

  readonly form = new FormGroup({
    providerType: new FormControl<ProviderType | null>(null, Validators.required),
    providerName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sectionId: new FormControl<string | null>(
      this.data.preselectedSectionId ?? this.data.sections[0]?.id ?? null,
      Validators.required
    ),
    assignedDate: new FormControl<string | null>(
      new Date().toISOString().split('T')[0],
      Validators.required
    ),
    contact: new FormControl('', { nonNullable: true })
  });

  onCancel(): void {
    this.modalRef.close(null);
  }

  onAssign(): void {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.modalRef.close({
      claimId: this.data.claimId,
      sectionId: v.sectionId!,
      providerName: v.providerName,
      providerType: v.providerType!,
      status: 'Active',
      assignedDate: v.assignedDate!,
      contact: v.contact || undefined
    });
  }
}
