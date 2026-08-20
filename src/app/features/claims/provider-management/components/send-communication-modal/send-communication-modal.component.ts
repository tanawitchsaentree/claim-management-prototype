import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { ProviderAssignment } from '../../../../../core/models/provider-assignment.model';
import { ProviderCommunicationResult } from '../../../../../core/models/provider-communication.model';
import { AttachmentPickerComponent, AttachmentSelection } from '../attachment-picker/attachment-picker.component';

export interface SendCommunicationModalData {
  claimId: string;
  assignment: ProviderAssignment;
  isExternal: boolean;
}

@Component({
  selector: 'app-send-communication-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    AttachmentPickerComponent,
  ],
  templateUrl: './send-communication-modal.component.html',
  styleUrl: './send-communication-modal.component.scss',
})
export class SendCommunicationModalComponent {
  readonly data = inject<SendCommunicationModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<SendCommunicationModalComponent, ProviderCommunicationResult | null>>(NxModalRef);

  private attachments: AttachmentSelection = { documentIds: [], uploadedFiles: [] };

  readonly form = new FormGroup({
    subject: new FormControl(
      `Instruction — ${this.data.claimId} — ${this.data.assignment.providerName}`,
      { nonNullable: true, validators: [Validators.required] },
    ),
    body: new FormControl(
      `Claim reference: ${this.data.claimId}\nAssignment: ${this.data.assignment.providerName} (${this.data.assignment.assignmentId})\nAssigned: ${this.data.assignment.assignedDate}`,
      { nonNullable: true, validators: [Validators.required] },
    ),
    additionalInstructions: new FormControl('', { nonNullable: true }),
  });

  onAttachmentSelectionChange(selection: AttachmentSelection): void {
    this.attachments = selection;
  }

  onCancel(): void {
    this.modalRef.close(null);
  }

  onSend(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.modalRef.close({
      sentAt: new Date().toISOString(),
      subject: this.form.getRawValue().subject,
      attachmentCount: this.attachments.documentIds.length + this.attachments.uploadedFiles.length,
    });
  }
}
