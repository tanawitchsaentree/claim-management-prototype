import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { Navbar } from '../layout/navbar/navbar';
import { MockApprovalService } from '../../core/mock/services/mock-approval.service';
import { MockDashboardExtendedService } from '../../core/mock/services/mock-dashboard-extended.service';
import { AuthService } from '../../core/services/auth';
import { UrgentApproval } from '../../core/models/approval.model';
import { PaymentApproval } from '../../core/models/dashboard-extended.model';
import { firstValueFrom } from 'rxjs';
import { ClaimPreviewDirective } from '../../shared/directives/claim-preview.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxContextMenuModule,
    NxSwitcherModule,
    NxGridModule,
    Navbar,
    ClaimPreviewDirective,
    EmptyStateComponent,
  ],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss',
})
export class ApprovalsComponent implements OnInit {
  private readonly approvalSvc = inject(MockApprovalService);
  private readonly extSvc      = inject(MockDashboardExtendedService);
  readonly auth                 = inject(AuthService);

  readonly activeTab    = signal<'reserves' | 'payments'>('reserves');
  readonly showMineOnly = signal(false);

  // Filter fields
  filterClaimId    = '';
  filterRequester  = '';
  filterDate: Date | null = null;

  private allReserves  = signal<UrgentApproval[]>([]);
  private allPayments  = signal<PaymentApproval[]>([]);

  readonly filteredReserves = computed(() => {
    let list = this.allReserves();
    if (this.showMineOnly()) {
      list = list.filter(r => r.reviewerEmail === this.auth.user()?.email);
    }
    if (this.filterClaimId.trim()) {
      const q = this.filterClaimId.trim().toLowerCase();
      list = list.filter(r => r.claimId.toLowerCase().includes(q));
    }
    if (this.filterRequester.trim()) {
      const q = this.filterRequester.trim().toLowerCase();
      list = list.filter(r => r.requester.toLowerCase().includes(q));
    }
    return list;
  });

  readonly filteredPayments = computed(() => {
    let list = this.allPayments();
    if (this.showMineOnly()) {
      list = list.filter(p => p.reviewerEmail === this.auth.user()?.email);
    }
    if (this.filterClaimId.trim()) {
      const q = this.filterClaimId.trim().toLowerCase();
      list = list.filter(p => p.claimId.toLowerCase().includes(q));
    }
    if (this.filterRequester.trim()) {
      const q = this.filterRequester.trim().toLowerCase();
      list = list.filter(p => p.requester.toLowerCase().includes(q));
    }
    return list;
  });

  async ngOnInit(): Promise<void> {
    const [reserves, payments] = await Promise.all([
      firstValueFrom(this.approvalSvc.getAll()),
      firstValueFrom(this.extSvc.getPaymentApprovals()),
    ]);
    this.allReserves.set(reserves);
    this.allPayments.set(payments);
  }

  applyFilter(): void {
    // signals re-compute on next read — nothing needed here
  }

  resetFilter(): void {
    this.filterClaimId   = '';
    this.filterRequester = '';
    this.filterDate      = null;
  }

  onAction(action: string, id: string): void {
    console.log(action, id);
  }
}
