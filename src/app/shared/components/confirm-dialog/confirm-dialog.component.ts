import { Component, inject } from '@angular/core';

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
   * Kept for callers that already build a diff (recovery-potential-card,
   * trade-sanctions-card, etc.) — no longer rendered as a table here.
   * User call 2026-09-24: replace the diff table with a plain icon+message
   * confirm. `message` is now expected to state the change in prose instead.
   */
  changes?: ConfirmDialogChange[];
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [NxModalModule, NxButtonModule, NxIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ConfirmDialogComponent, boolean>>(NxModalRef);

  onCancel(): void {
    this.modalRef.close(false);
  }
  onConfirm(): void {
    this.modalRef.close(true);
  }
}
