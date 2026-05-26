import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import usersData from '../../../../core/mock/data/users.json';

export interface StartInvestigationModalData {
  claimId: string;
}

export interface StartInvestigationResult {
  assignee: string;
  deadline: string;
  notes:    string;
}

interface User { userId: string; name: string; role: string; }

@Component({
  selector: 'app-start-investigation-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxDatefieldModule,
  ],
  templateUrl: './start-investigation-modal.component.html',
  styleUrl: './start-investigation-modal.component.scss',
})
export class StartInvestigationModalComponent {
  readonly data = inject<StartInvestigationModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<StartInvestigationModalComponent, StartInvestigationResult | null>>(NxModalRef);

  readonly handlers = (usersData as User[]).filter(u => u.role === 'claim handler');

  readonly form = new FormGroup({
    assignee: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    deadline: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
    notes:    new FormControl<string>('', { nonNullable: true }),
  });

  onCancel(): void { this.modalRef.close(null); }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close(this.form.getRawValue());
  }
}
