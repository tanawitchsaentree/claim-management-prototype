import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { firstValueFrom } from 'rxjs';
import { RejectionApproval } from '../../../core/models/approval.model';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { MockRejectionApprovalService } from '../../../core/mock/services/mock-rejection-approval.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { ClaimClosureService } from '../../../core/services/claim-closure.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RequesterNamePipe } from '../../../shared/pipes/requester-name.pipe';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { ClaimNumberPipe } from '../../../shared/pipes/claim-number.pipe';

// BMPCC-17630 — Approvals > Claims tab. Column set is a draft: the ticket says it
// is still to be defined (Open Point #6), and the approver Level column is left
// out until the claim-value threshold is known.
@Component({
  selector: 'app-claims-rejection-table',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NxTableModule,
    NxIconModule,
    NxButtonModule,
    NxContextMenuModule,
    ClaimPreviewDirective,
    EmptyStateComponent,
    RequesterNamePipe,
    ClaimNumberPipe,
    AppDatePipe
  ],
  templateUrl: './claims-rejection-table.component.html',
  styleUrl: '../approvals.component.scss'
})
export class ClaimsRejectionTableComponent {
  readonly claimId = input('');
  readonly requester = input('');

  private readonly rejectionSvc = inject(MockRejectionApprovalService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly stateSvc = inject(MockStateService);
  private readonly toast = inject(ToastService);

  private readonly all = signal<RejectionApproval[]>([]);
  private readonly busy = signal(false);

  readonly rows = computed(() => {
    const id = this.claimId().trim().toLowerCase();
    const who = this.requester().trim().toLowerCase();
    return this.all().filter(
      r =>
        (!id || r.claimId.toLowerCase().includes(id)) &&
        (!who || r.requester.toLowerCase().includes(who))
    );
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.all.set(await firstValueFrom(this.rejectionSvc.getPending()));
  }

  async approve(item: RejectionApproval): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(
        this.closureSvc.closeClaim(item.claimId, {
          reason: 'Claim Rejected',
          retentionType: 'default',
          confirmedBy: { userId: 'usr-current', name: item.requester }
        })
      );
      this.logStatus(item, 'Closed');
      await this.load();
      this.toast.success('Rejection approved', `${item.claimId} closed as Claim Rejected`);
    } catch {
      this.toast.error('Failed to approve rejection', 'Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  async decline(item: RejectionApproval): Promise<void> {
    if (this.busy()) return;
    this.stateSvc.patchOverview(item.claimId, {
      status: 'Open',
      rejectionRequestedAt: undefined,
      rejectionRequestedBy: undefined
    });
    this.logStatus(item, 'Open');
    await this.load();
    this.toast.info('Rejection declined', `${item.claimId} reverted to Open`);
  }

  private logStatus(item: RejectionApproval, valueNew: string): void {
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: item.claimId,
      user: item.requester,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Status',
      valueOld: 'Pending Rejection Approval',
      valueNew
    };
    this.overviewSvc.appendActivities(item.claimId, [activity]);
  }
}
