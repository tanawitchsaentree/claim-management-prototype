import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';

export interface ReasonDialogData {
  title: string;
  message: string;
  /** Label of the free-text field, e.g. "Reason for declining". */
  reasonLabel: string;
  confirmLabel: string;
  /** What the handler wrote, shown above the field so the approver sees it. */
  handlerReason?: string;
}

/**
 * A confirm that needs a free-text reason before it can go through. Closes with
 * the trimmed reason, or undefined when cancelled.
 */
@Component({
  selector: 'app-reason-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule
  ],
  templateUrl: './reason-dialog.component.html',
  styleUrl: './reason-dialog.component.scss'
})
export class ReasonDialogComponent {
  readonly data = inject<ReasonDialogData>(NX_MODAL_DATA);
  private readonly modalRef = inject<NxModalRef<ReasonDialogComponent, string>>(NxModalRef);

  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]
  });

  onCancel(): void {
    this.modalRef.close(undefined);
  }

  onConfirm(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      return;
    }
    this.modalRef.close(this.reason.value.trim());
  }
}
