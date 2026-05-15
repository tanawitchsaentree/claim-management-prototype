import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { MockTaskService } from '../../core/mock/services/mock-task.service';
import { MockClaimService } from '../../core/mock/services/mock-claim.service';
import { MockApprovalService } from '../../core/mock/services/mock-approval.service';
import { Claim, ClaimStats, DashboardVM, QuickLink } from '../../core/models';

const QUICK_LINKS: QuickLink[] = [
  { label: 'AGCS Corporate Rules Book' },
  { label: 'Link 1' },
  { label: 'Link 2' },
];

const EMPTY_VM: DashboardVM = {
  loading: true,
  error: null,
  tasks: [],
  recentClaims: [],
  stats: { total: 0, opened: 0, closed: 0 },
  quickLinks: QUICK_LINKS,
  portfolioTab: 'claims',
  urgentApprovals: [],
};

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, NxButtonModule, NxIconModule, NxSpinnerModule, NxSwitcherModule, StatusChipComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private taskSvc     = inject(MockTaskService);
  private claimSvc    = inject(MockClaimService);
  private approvalSvc = inject(MockApprovalService);
  private router      = inject(Router);

  readonly vm$: Observable<DashboardVM> = combineLatest([
    this.taskSvc.getAll(),
    this.claimSvc.getAll(),
    this.approvalSvc.getAll(),
  ]).pipe(
    map(([tasks, claims, urgentApprovals]) => ({
      loading: false,
      error: null,
      tasks: tasks.slice(0, 7),
      recentClaims: claims.slice(0, 5),
      stats: this.buildStats(claims),
      quickLinks: QUICK_LINKS,
      portfolioTab: 'claims' as const,
      urgentApprovals,
    })),
    startWith(EMPTY_VM),
    catchError(err => of({
      loading: false,
      error: (err as { message?: string })?.message ?? 'Failed to load dashboard data.',
      tasks: [],
      recentClaims: [],
      stats: { total: 0, opened: 0, closed: 0 },
      quickLinks: QUICK_LINKS,
      portfolioTab: 'claims' as const,
      urgentApprovals: [],
    }))
  );

  portfolioTab: 'claims' | 'loss-events' = 'claims';

  navigateToFnol(): void {
    this.router.navigate(['/fnol/search']);
  }

  setPortfolioTab(tab: 'claims' | 'loss-events'): void {
    this.portfolioTab = tab;
  }

  barWidth(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  private buildStats(claims: Claim[]): ClaimStats {
    const opened = claims.filter(c => c.status === 'Open' || c.status === 'In progress').length;
    const closed = claims.filter(c => c.status === 'Closed' || c.status === 'Declined').length;
    return { total: claims.length, opened, closed };
  }
}
