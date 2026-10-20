import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';

export interface SendAgainDialogData {
  title: string;
  message: string;
  /** Label of a tick box the handler must tick before it goes (data they had to correct). */
  confirmFixed?: string;
}

/** Confirm step for "Send again": looks like the shared confirm dialog, plus the optional required tick box. */
@Component({
  selector: 'app-send-again-dialog',
  standalone: true,
  imports: [NxModalModule, NxButtonModule, NxIconModule, NxCheckboxModule, ReactiveFormsModule],
  templateUrl: './send-again-dialog.component.html',
  styleUrl: './send-again-dialog.component.scss'
})
export class SendAgainDialogComponent {
  readonly data = inject<SendAgainDialogData>(NX_MODAL_DATA);
  private readonly modalRef = inject<NxModalRef<SendAgainDialogComponent, boolean>>(NxModalRef);
  readonly fixed = new FormControl(false, { nonNullable: true });

  get canSend(): boolean {
    return !this.data.confirmFixed || this.fixed.value;
  }

  onCancel(): void {
    this.modalRef.close(false);
  }

  onConfirm(): void {
    if (this.canSend) this.modalRef.close(true);
  }
}
