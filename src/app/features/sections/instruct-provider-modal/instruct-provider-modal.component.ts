import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalRef, NX_MODAL_DATA, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimSection } from '../../../core/models/section.model';

export interface InstructProviderModalData {
  section: ClaimSection;
}

export interface InstructProviderModalResult {
  provider: string;
  instruction: string;
  priority: string;
}

const PROVIDERS  = ['Allianz Expertise Center', 'External Expert GmbH', 'Deutsche Sachverständige AG', 'TÜV Expert Services'];
const PRIORITIES = ['Standard', 'Urgent', 'Critical'];

@Component({
  selector: 'app-instruct-provider-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxDropdownModule, NxInputModule, NxButtonModule],
  templateUrl: './instruct-provider-modal.component.html',
  styleUrl: './instruct-provider-modal.component.scss',
})
export class InstructProviderModalComponent {
  readonly data     = inject<InstructProviderModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<InstructProviderModalComponent, InstructProviderModalResult>>(NxModalRef);
  private readonly fb = inject(FormBuilder);

  readonly providers  = PROVIDERS;
  readonly priorities = PRIORITIES;

  readonly form = this.fb.group({
    provider:    [this.data.section.entities[0]?.assignedProvider ?? '', Validators.required],
    instruction: ['', [Validators.required, Validators.minLength(10)]],
    priority:    ['Standard', Validators.required],
  });

  confirm(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.modalRef.close({
      provider:    this.form.value.provider!,
      instruction: this.form.value.instruction!,
      priority:    this.form.value.priority!,
    });
  }

  cancel(): void { this.modalRef.close(); }
}
