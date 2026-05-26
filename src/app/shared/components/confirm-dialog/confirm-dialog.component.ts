import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmDanger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, NxModalModule, NxButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly data     = inject<ConfirmDialogData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ConfirmDialogComponent, boolean>>(NxModalRef);

  onCancel(): void  { this.modalRef.close(false); }
  onConfirm(): void { this.modalRef.close(true);  }
}
