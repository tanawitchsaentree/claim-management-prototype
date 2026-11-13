import {
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
  ChangeDetectionStrategy
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { AuthService } from '../../../core/services/auth';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockAssignmentService } from '../../../core/mock/services/mock-assignment.service';
import { ToastService } from '../toast/toast.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../confirm-dialog/confirm-dialog.component';
import {
  ReassignClaimModalComponent,
  ReassignClaimModalData,
  ReassignClaimModalResult,
  ReassignClaimRow
} from './reassign-claim-modal.component';

export interface ClaimAssignmentInput {
  claimId: string;
  client: string;
  assignedHandler: string;
  status: string;
}

// BMPCC-22666 AC02 / AC03: the actions beside "Assigned Claim handler" on
// Claim Overview. Your claim (or your team's, as its manager): Reassign.
// A colleague's claim in your team: Take claim. Another team's claim, or one
// above your authority: Take claim is not offered and the line says why and
// who can move it (DESIGN DECISION RA-AUTH-3).
@Component({
  selector: 'app-claim-assignment-actions',
  standalone: true,
  imports: [NxLinkModule, NxIconModule],
  template: `
    @if (reassignCheck().allowed) {
      <nx-link size="small"
        ><a tabindex="0" (click)="openReassign()" (keydown.enter)="openReassign()"
          >Reassign</a
        ></nx-link
      >
    } @else if (takeCheck().allowed) {
      <nx-link size="small"
        ><a tabindex="0" (click)="take()" (keydown.enter)="take()">Take claim</a></nx-link
      >
    } @else if (takeCheck().reason && claim().status !== 'Closed') {
      <span class="caa-blocked">
        <nx-icon name="info-circle-o" size="s" aria-hidden="true"></nx-icon>
        <span>{{ takeCheck().reason }}</span>
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './claim-assignment-actions.component.scss'
})
export class ClaimAssignmentActionsComponent {
  readonly claim = input.required<ClaimAssignmentInput>();
  @Output() reassigned = new EventEmitter<string>();

  private readonly auth = inject(AuthService);
  private readonly stateSvc = inject(MockStateService);
  private readonly assignSvc = inject(MockAssignmentService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);

  // Overview shows the handler; the claim record has the group (team queue)
  // and the amount (authority check).
  private readonly row = computed<ReassignClaimRow>(() => {
    const c = this.claim();
    const record = this.stateSvc.state().claims.find(x => x.claimId === c.claimId);
    const owner = c.assignedHandler && c.assignedHandler !== 'Unassigned' ? c.assignedHandler : null;
    return {
      claimId: c.claimId,
      clientName: c.client,
      owner,
      group: record?.group ?? null,
      status: c.status,
      lossAmount: record?.lossAmount ?? 0,
      currency: record?.currency ?? 'EUR'
    };
  });

  readonly reassignCheck = computed(() => this.assignSvc.canReassign(this.row(), this.auth.user()));
  readonly takeCheck = computed(() => this.assignSvc.canTake(this.row(), this.auth.user()));

  async openReassign(): Promise<void> {
    const ref = this.dialogSvc.open(ReassignClaimModalComponent, {
      data: { claims: [this.row()] } satisfies ReassignClaimModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as ReassignClaimModalResult | null;
    if (!result?.saved) return;
    this.toast.success(
      'Claim reassigned',
      `${this.row().claimId} is now with ${result.saved.targetLabel}. Both handlers have been notified.`
    );
    this.reassigned.emit(result.saved.targetLabel);
  }

  async take(): Promise<void> {
    const row = this.row();
    const me = this.auth.user().name;
    const from = this.assignSvc.ownerLabel(row);
    const data: ConfirmDialogData = {
      title: 'Take this claim?',
      message: `${row.claimId} will move from ${from} to you and show in your claims. ${
        row.owner ? `${row.owner} will be notified.` : ''
      }`,
      confirmLabel: 'Yes, take claim',
      cancelLabel: 'Cancel',
      hideIcon: true
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '480px', maxWidth: '92vw' });
    if ((await firstValueFrom(ref.afterClosed())) !== true) return;
    try {
      await firstValueFrom(
        this.assignSvc.reassign([row], { kind: 'handler', name: me, detail: '' }, me)
      );
      this.toast.success('Claim taken', `${row.claimId} is now yours.`);
      this.reassigned.emit(me);
    } catch {
      this.toast.error('Could not take the claim', `${row.claimId} is still with ${from}. Try again.`);
    }
  }
}
