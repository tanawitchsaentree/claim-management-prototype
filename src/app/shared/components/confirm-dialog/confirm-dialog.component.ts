import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';

/** One field's before/after, rendered as a row in the dialog's change table. */
export interface ConfirmDialogChange {
  label: string;
  original: string;
  updated: string;
}

export interface ConfirmDialogData {
  title: string;
  message: string;
  /**
   * What is about to be written. A confirm step that only asks "are you sure?"
   * is the barrier nobody reads — every save that passes a diff here gets a
   * dialog that STATES the change instead of charging a second click for
   * nothing. Same Field / Original → Updated table as
   * loss-info-confirm-modal.component.html:21.
   */
  changes?: ConfirmDialogChange[];
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule, NxIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly data     = inject<ConfirmDialogData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ConfirmDialogComponent, boolean>>(NxModalRef);

  onCancel(): void  { this.modalRef.close(false); }
  onConfirm(): void { this.modalRef.close(true);  }
}
