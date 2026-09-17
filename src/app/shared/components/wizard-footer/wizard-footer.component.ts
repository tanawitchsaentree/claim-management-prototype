import { Component, Input, Output, EventEmitter, inject } from '@angular/core';

import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../confirm-dialog/confirm-dialog.component';

// BMPCC-17676 / BMPCC-17733: every FNOL step's Cancel routed straight to
// /dashboard with zero confirmation. Fixed once, here, instead of in each of
// the 8 step components that use this footer — same "single source of truth"
// reasoning as the Back/Next button styling this component already owns
// (BLESSED.md: never hand-roll these buttons per step).
@Component({
  selector: 'app-wizard-footer',
  standalone: true,
  imports: [NxButtonModule, NxIconModule],
  templateUrl: './wizard-footer.component.html',
  styleUrl: './wizard-footer.component.scss'
})
export class WizardFooterComponent {
  @Input() nextLabel = 'Next';
  @Input() nextDisabled = false;
  @Input() showBack = true;
  @Input() showCancel = true;

  // Named cancelClick, not cancel — @angular-eslint/no-output-native bans
  // Output names that collide with a real DOM event (<dialog>/<input type=file>
  // both fire a native "cancel" event), which shadowing would silently break.
  @Output() cancelClick = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  private readonly dialogSvc = inject(NxDialogService);

  async onCancelClick(): Promise<void> {
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Leave this claim notification?',
        message: "Any information you've entered on this step will be lost. This cannot be undone.",
        confirmLabel: 'Leave',
        cancelLabel: 'Stay',
        confirmDanger: true
      } satisfies ConfirmDialogData,
      width: '420px',
      maxWidth: '92vw'
    });
    const confirmed = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (confirmed) this.cancelClick.emit();
  }
}
