import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NX_MODAL_DATA, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { Note } from '../../../core/models/note.model';
import { MockNotesService } from '../../../core/mock/services/mock-notes.service';
import { firstValueFrom } from 'rxjs';

export interface AddCommentModalData {
  claimId: string;
  attachTo: string;
}

export interface AddCommentModalResult {
  notes: Note[];
}

const CATEGORY_OPTIONS: Note['section'][] = ['general', 'recovery', 'litigation'];

@Component({
  selector: 'app-add-comment-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxButtonModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxInputModule,
    NxIconModule,
  ],
  templateUrl: './add-comment-modal.component.html',
  styleUrl: './add-comment-modal.component.scss',
})
export class AddCommentModalComponent {
  readonly data     = inject<AddCommentModalData>(NX_MODAL_DATA);
  readonly modalRef = inject(NxModalRef);
  private readonly notesSvc = inject(MockNotesService);

  readonly categories = CATEGORY_OPTIONS;

  readonly form = new FormGroup({
    title:    new FormControl('', { nonNullable: true }),
    category: new FormControl<Note['section']>('general', { nonNullable: true, validators: [Validators.required] }),
    body:     new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(1)] }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, category, body } = this.form.getRawValue();
    const notes = await firstValueFrom(
      this.notesSvc.addNote(this.data.claimId, { title, section: category, body })
    );
    this.modalRef.close({ notes } satisfies AddCommentModalResult);
  }

  cancel(): void {
    this.modalRef.close(undefined);
  }
}
