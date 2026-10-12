import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxGridModule } from '@allianz/ng-aquila/grid';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { Navbar } from '../layout/navbar/navbar';
import { MockApprovalService } from '../../core/mock/services/mock-approval.service';
import { MockFinancialOverviewService } from '../../core/mock/services/mock-financial-overview.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { MockDashboardExtendedService } from '../../core/mock/services/mock-dashboard-extended.service';
import { AuthService } from '../../core/services/auth';
import { UrgentApproval } from '../../core/models/approval.model';
import { PaymentApproval } from '../../core/models/dashboard-extended.model';
import { firstValueFrom } from 'rxjs';
import { ClaimPreviewDirective } from '../../shared/directives/claim-preview.directive';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { RequesterNamePipe } from '../../shared/pipes/requester-name.pipe';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxContextMenuModule,
    NxSwitcherModule,
    NxGridModule,
    NxFormfieldModule,
    NxInputModule,
    NxDatefieldModule,
    Navbar,
    ClaimPreviewDirective,
    EmptyStateComponent,
    RequesterNamePipe
  ],
  templateUrl: './approvals.component.html',
  styleUrl: './approvals.component.scss'
})
export class ApprovalsComponent implements OnInit {
  private readonly approvalSvc = inject(MockApprovalService);
  private readonly extSvc = inject(MockDashboardExtendedService);
  private readonly financialSvc = inject(MockFinancialOverviewService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly activeTab = signal<'reserves' | 'payments'>('reserves');
  readonly showMineOnly = signal(false);

  // Filter fields
  readonly filterForm = new FormGroup({
    claimId: new FormControl(''),
    requester: new FormControl(''),
    date: new FormControl<string | null>(null)
  });
  private readonly filterValue = toSignal(this.filterForm.valueChanges, {
    initialValue: this.filterForm.value
  });

  private allReserves = signal<UrgentApproval[]>([]);
  private allPayments = signal<PaymentApproval[]>([]);

  readonly filteredReserves = computed(() => {
    let list = this.allReserves();
    if (this.showMineOnly()) {
      list = list.filter(r => r.reviewerEmail === this.auth.user()?.email);
    }
    const claimId = (this.filterValue().claimId ?? '').trim();
    if (claimId) {
      const q = claimId.toLowerCase();
      list = list.filter(r => r.claimId.toLowerCase().includes(q));
    }
    const requester = (this.filterValue().requester ?? '').trim();
    if (requester) {
      const q = requester.toLowerCase();
      list = list.filter(r => r.requester.toLowerCase().includes(q));
    }
    return list;
  });

  readonly filteredPayments = computed(() => {
    let list = this.allPayments();
    if (this.showMineOnly()) {
      list = list.filter(p => p.reviewerEmail === this.auth.user()?.email);
    }
    const claimId = (this.filterValue().claimId ?? '').trim();
    if (claimId) {
      const q = claimId.toLowerCase();
      list = list.filter(p => p.claimId.toLowerCase().includes(q));
    }
    const requester = (this.filterValue().requester ?? '').trim();
    if (requester) {
      const q = requester.toLowerCase();
      list = list.filter(p => p.requester.toLowerCase().includes(q));
    }
    return list;
  });

  async ngOnInit(): Promise<void> {
    const payments = await firstValueFrom(this.extSvc.getPaymentApprovals());
    this.allPayments.set(payments);
    await this.loadReserves();
  }

  private async loadReserves(): Promise<void> {
    this.allReserves.set(await firstValueFrom(this.approvalSvc.getAll()));
  }

  applyFilter(): void {
    // signals re-compute on next read — nothing needed here
  }

  resetFilter(): void {
    this.filterForm.reset();
  }

  async onAction(action: 'approve' | 'reject' | 'view', item: UrgentApproval): Promise<void> {
    if (action === 'view') {
      await this.router.navigate(['/claims', item.claimId, 'financial'], {
        queryParams: { view: 'reserves' }
      });
      return;
    }
    const me = this.auth.user();
    if (item.requester && item.requester.toLowerCase() === me.email.toLowerCase()) {
      this.toast.warning('Needs another approver', 'You requested this reserve, so someone else has to approve it.');
      return;
    }
    const decision = action === 'approve' ? 'Approved' : 'Rejected';
    if (this.approvalSvc.isRealReserve(item.requestId)) {
      await firstValueFrom(this.financialSvc.decideReserve(item.claimId, item.requestId, decision));
    } else {
      this.approvalSvc.decideSeeded(item.requestId);
    }
    await this.loadReserves();
    this.toast.success(`Reserve ${decision.toLowerCase()}`, `${item.claimId}: ${item.requestId}`);
  }

  // Payment approvals are still a stub (not part of the reserves flow).
  onPaymentAction(action: string, id: string): void {
    console.log(action, id);
  }
}
