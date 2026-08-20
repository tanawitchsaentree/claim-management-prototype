import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { TrackerService } from '../../../core/services/tracker.service';

export interface AddNoteModalData {
  ticketId: string;
  createdBy: string;
}

@Component({
  selector: 'app-add-note-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NxModalModule, NxFormfieldModule, NxInputModule, NxButtonModule, NxSpinnerModule],
  templateUrl: './add-note-modal.component.html',
  styleUrl: './add-note-modal.component.scss',
})
export class AddNoteModalComponent {
  readonly data = inject<AddNoteModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddNoteModalComponent, boolean>>(NxModalRef);
  private readonly trackerService = inject(TrackerService);

  readonly body = new FormControl('', [Validators.required]);
  readonly saving = signal(false);

  async save(): Promise<void> {
    if (this.body.invalid) {
      this.body.markAsTouched();
      return;
    }

    this.saving.set(true);
    await this.trackerService.addNote(this.data.ticketId, this.body.value!, this.data.createdBy);
    this.saving.set(false);
    this.modalRef.close(true);
  }

  cancel(): void {
    this.modalRef.close(false);
  }
}
