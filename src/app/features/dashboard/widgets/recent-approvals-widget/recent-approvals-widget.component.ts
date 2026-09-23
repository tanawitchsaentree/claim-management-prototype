import { Component, Input, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ClaimPreviewDirective } from '../../../../shared/directives/claim-preview.directive';
import { RequesterNamePipe } from '../../../../shared/pipes/requester-name.pipe';
import { AuthService } from '../../../../core/services/auth';
import { UrgentApproval, PaymentApproval } from '../../../../core/models';

@Component({
  selector: 'app-recent-approvals-widget',
  standalone: true,
  imports: [
    DecimalPipe,
    RouterLink,
    NxIconModule,
    NxSwitcherModule,
    NxBadgeModule,
    NxTableModule,
    NxContextMenuModule,
    EmptyStateComponent,
    ClaimPreviewDirective,
    RequesterNamePipe
  ],
  templateUrl: './recent-approvals-widget.component.html',
  styleUrl: './recent-approvals-widget.component.scss'
})
export class RecentApprovalsWidgetComponent {
  @Input({ required: true }) approvals: UrgentApproval[] = [];
  @Input({ required: true }) payments: PaymentApproval[] = [];

  readonly auth = inject(AuthService);

  readonly showMyApprovalsOnly = signal(false);
  readonly approvalsTab = signal<'reserves' | 'payments'>('reserves');
  setApprovalsTab(tab: 'reserves' | 'payments'): void {
    this.approvalsTab.set(tab);
  }

  // `requester` on the mock records is an email — this used to compare it
  // against the logged-in persona's *name*, which can never match (wrong
  // field entirely), so the toggle silently showed nothing whenever it was
  // switched on.
  readonly displayedApprovals = computed<UrgentApproval[]>(() => {
    if (!this.showMyApprovalsOnly()) return this.approvals;
    const email = this.auth.user()?.email ?? '';
    return this.approvals.filter(a => a.requester === email);
  });

  readonly displayedPayments = computed<PaymentApproval[]>(() => {
    if (!this.showMyApprovalsOnly()) return this.payments;
    const email = this.auth.user()?.email ?? '';
    return this.payments.filter(p => p.requester === email);
  });

  isOwnRequest(requesterEmail: string): boolean {
    return requesterEmail === this.auth.user()?.email;
  }
}
