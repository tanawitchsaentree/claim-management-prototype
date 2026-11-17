import { Component, computed, effect, inject, input, untracked, ChangeDetectionStrategy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockFnolAcknowledgementService } from '../../../core/mock/services/mock-fnol-acknowledgement.service';
import { FnolAckLetter } from '../../../core/models/fnol-acknowledgement.model';
import { AppDatePipe } from '../../pipes/app-date.pipe';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import {
  FnolAcknowledgementPreviewComponent,
  FnolAckPreviewData
} from '../fnol-acknowledgement-preview/fnol-acknowledgement-preview.component';

// BMPCC-22635: the one FNOL Acknowledgement control, used on the FNOL
// confirmation screen and on Claim Overview (DESIGN DECISION FNOL-ACK-1 in
// fnol-acknowledgement.model.ts). Reads the claim's live state, so a
// generation started on the FNOL screen shows as running on Claim Overview.
@Component({
  selector: 'app-fnol-acknowledgement-panel',
  standalone: true,
  imports: [NxButtonModule, NxMessageModule, NxSpinnerModule, AppDatePipe],
  templateUrl: './fnol-acknowledgement-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './fnol-acknowledgement-panel.component.scss'
})
export class FnolAcknowledgementPanelComponent {
  private readonly stateSvc = inject(MockStateService);
  private readonly ackSvc = inject(MockFnolAcknowledgementService);
  private readonly dialogSvc = inject(NxDialogService);

  readonly claimId = input.required<string>();
  // FNOL screen with several claims: say which claim each panel is for.
  readonly showClaimId = input(false);

  private readonly claim = computed(() => this.stateSvc.state().overviews[this.claimId()]);
  readonly ack = computed(() => this.claim()?.fnolAck);
  readonly availability = computed(() => this.ackSvc.availability(this.claim()));
  readonly reasonId = computed(() => `fa-reason-${this.claimId()}`);

  constructor() {
    // "Generating" with nobody waiting for the answer (reload, DEV banner): resume it.
    effect(() => {
      if (this.ack()?.status === 'generating') untracked(() => this.ackSvc.ensureRunning(this.claimId()));
    });
  }

  async generate(): Promise<void> {
    const again = this.ack()?.status === 'generated' || !!this.ack()?.previous;
    const data: ConfirmDialogData = again
      ? {
          title: 'Generate a new FNOL acknowledgement?',
          message: `The new letter for ${this.claimId()} uses the claim and policy details as they are now. The earlier letter stays on the claim. Nothing is sent: you send the letter yourself.`,
          confirmLabel: 'Generate new letter',
          hideIcon: true
        }
      : {
          title: 'Generate the FNOL acknowledgement?',
          message: `The letter for ${this.claimId()} uses the claim and policy details as they are now. Nothing is sent: you send the letter yourself.`,
          confirmLabel: 'Generate',
          hideIcon: true
        };
    const ref = this.dialogSvc.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data,
      width: '480px'
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    await this.ackSvc.generate(this.claimId());
  }

  /** Try again after a failure: the handler already confirmed once. */
  retry(): void {
    void this.ackSvc.generate(this.claimId());
  }

  open(documentName: string, generatedAt: string, letter: FnolAckLetter | undefined): void {
    if (!letter) return;
    this.dialogSvc.open<FnolAcknowledgementPreviewComponent, FnolAckPreviewData>(FnolAcknowledgementPreviewComponent, {
      data: { documentName, generatedAt, letter },
      width: '640px'
    });
  }
}
