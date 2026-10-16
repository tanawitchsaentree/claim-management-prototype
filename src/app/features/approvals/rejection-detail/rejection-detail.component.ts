import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { NxBreadcrumbModule } from '@allianz/ng-aquila/breadcrumb';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { firstValueFrom } from 'rxjs';
import { Navbar } from '../../layout/navbar/navbar';
import { RejectionApproval, rejectionRequestId } from '../../../core/models/approval.model';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { MockRejectionApprovalService } from '../../../core/mock/services/mock-rejection-approval.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { RejectionApprovalService } from '../../../core/services/rejection-approval.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { ClaimNumberPipe } from '../../../shared/pipes/claim-number.pipe';
import { RequesterNamePipe } from '../../../shared/pipes/requester-name.pipe';

type Decision = 'pending' | 'approved' | 'declined';

// BMPCC-17630 — what opens when a Request ID is clicked on Approvals > Claims.
// Layout follows the Finance-domain reserve request page (breadcrumb, request
// title, claim info card, items card with Reject/Approve).
@Component({
  selector: 'app-rejection-detail',
  standalone: true,
  imports: [
    RouterModule,
    NxGridModule,
    NxBreadcrumbModule,
    NxTableModule,
    NxCheckboxModule,
    NxButtonModule,
    NxIconModule,
    NxSwitcherModule,
    NxContextMenuModule,
    Navbar,
    StatusChipComponent,
    EmptyStateComponent,
    AppDatePipe,
    ClaimNumberPipe,
    RequesterNamePipe
  ],
  templateUrl: './rejection-detail.component.html',
  styleUrl: './rejection-detail.component.scss'
})
export class RejectionDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rejectionSvc = inject(MockRejectionApprovalService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly decisionSvc = inject(RejectionApprovalService);
  private readonly toast = inject(ToastService);

  readonly claimId = this.route.snapshot.paramMap.get('claimId') ?? '';
  readonly requestId = rejectionRequestId(this.claimId);

  readonly loaded = signal(false);
  readonly item = signal<RejectionApproval | null>(null);
  readonly claim = signal<ClaimOverview | null>(null);
  readonly decision = signal<Decision>('pending');
  readonly selected = signal(false);
  readonly pendingOnly = signal(false);
  readonly busy = signal(false);

  readonly showRow = computed(
    () => this.item() !== null && (!this.pendingOnly() || this.decision() === 'pending')
  );
  readonly canDecide = computed(() => this.selected() && this.decision() === 'pending' && !this.busy());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [pending, claim] = await Promise.all([
      firstValueFrom(this.rejectionSvc.getPending()),
      firstValueFrom(this.overviewSvc.getOverview(this.claimId)).catch(() => null)
    ]);
    this.item.set(pending.find(r => r.claimId === this.claimId) ?? null);
    this.claim.set(claim);
    this.loaded.set(true);
  }

  statusChip(): { status: string; label: string } {
    switch (this.decision()) {
      case 'approved':
        return { status: 'closed', label: 'Approved' };
      case 'declined':
        return { status: 'declined', label: 'Declined' };
      default:
        return { status: 'pending-rejection-approval', label: 'Pending approval' };
    }
  }

  async approve(): Promise<void> {
    const item = this.item();
    if (!item || !this.canDecide()) return;
    this.busy.set(true);
    try {
      await this.decisionSvc.approve(item);
      this.decision.set('approved');
      this.selected.set(false);
      this.toast.success('Rejection approved', `${item.claimId} closed as Claim Rejected`);
    } catch {
      this.toast.error('Failed to approve rejection', 'Please try again.');
    } finally {
      this.busy.set(false);
    }
  }

  decline(): void {
    const item = this.item();
    if (!item || !this.canDecide()) return;
    this.decisionSvc.decline(item);
    this.decision.set('declined');
    this.selected.set(false);
    this.toast.info('Rejection declined', `${item.claimId} reverted to Open`);
  }

  backToApprovals(): void {
    void this.router.navigate(['/approvals'], { queryParams: { tab: 'claims' } });
  }
}
