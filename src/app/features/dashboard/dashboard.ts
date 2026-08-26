import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { MockTaskService } from '../../core/mock/services/mock-task.service';
import { MockClaimService } from '../../core/mock/services/mock-claim.service';
import { MockApprovalService } from '../../core/mock/services/mock-approval.service';
import { MockDashboardExtendedService } from '../../core/mock/services/mock-dashboard-extended.service';
import { AuthService } from '../../core/services/auth';
import { Claim, ClaimStats, DashboardVM, QuickLink, Task, ReserveMovement, LossEventSummary, PaymentApproval } from '../../core/models';

import { Navbar } from '../layout/navbar/navbar';

// Widgets
import { FinancialClosureBannerComponent } from './widgets/financial-closure-banner';
import { KpiRowComponent } from './widgets/kpi-row';
import { HeadsUpPanelComponent } from './widgets/heads-up-panel';
import { CalendarWidgetComponent } from './widgets/calendar-widget';
import { NewsPanelComponent } from './widgets/news-panel';
import { ExpenseBreakdownComponent } from './widgets/expense-breakdown';
import { ClaimsPortfolioWidgetComponent, ClaimsDateRange } from './widgets/claims-portfolio-widget/claims-portfolio-widget.component';
import { RecentApprovalsWidgetComponent } from './widgets/recent-approvals-widget/recent-approvals-widget.component';

const QUICK_LINKS: QuickLink[] = [
  { label: 'AGCS Corporate Rules Book', url: 'https://www.allianz.com/en/about-us/strategy-values/business-model.html' },
  { label: 'Claims Handling Guidelines',  url: 'https://www.allianz.com/en/about-us.html' },
  { label: 'Reserve Policy Handbook',     url: 'https://www.allianz.com/en/about-us.html' },
];

const EMPTY_VM: DashboardVM = {
  loading: true, error: null, tasks: [], recentClaims: [],
  stats: { total: 0, opened: 0, closed: 0 },
  quickLinks: QUICK_LINKS, portfolioTab: 'claims', urgentApprovals: [],
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    NxButtonModule, NxIconModule, NxSpinnerModule, NxSwitcherModule, NxTableModule,
    StatusChipComponent, EmptyStateComponent, Navbar,
    FinancialClosureBannerComponent, KpiRowComponent, HeadsUpPanelComponent,
    CalendarWidgetComponent, NewsPanelComponent, ExpenseBreakdownComponent,
    ClaimsPortfolioWidgetComponent, RecentApprovalsWidgetComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private taskSvc     = inject(MockTaskService);
  private claimSvc    = inject(MockClaimService);
  private approvalSvc = inject(MockApprovalService);
  private extSvc      = inject(MockDashboardExtendedService);
  readonly auth       = inject(AuthService);
  private router      = inject(Router);

  // ── Toggle state ─────────────────────────────────────────────────────
  readonly showMyTasksOnly     = signal(false);
  // ⚑ PLACEHOLDER default (Last 30 days) — the alignment doc raised "what is the default date
  // range on landing" as an open question with no business answer yet; confirm before launch.
  readonly claimsDateRange     = signal<ClaimsDateRange>(
    (localStorage.getItem('dashboard:claims-date-range') as ClaimsDateRange) ?? '30'
  );

  // ── Core vm$ ─────────────────────────────────────────────────────────
  readonly vm$: Observable<DashboardVM> = combineLatest([
    this.taskSvc.getAll(),
    this.claimSvc.getAll(),
    this.approvalSvc.getAll(),
  ]).pipe(
    map(([tasks, claims, urgentApprovals]) => ({
      loading: false, error: null,
      tasks,
      recentClaims: claims,
      stats: this.buildStats(claims),
      quickLinks: QUICK_LINKS,
      portfolioTab: 'claims' as const,
      urgentApprovals,
    })),
    startWith(EMPTY_VM),
    catchError(err => of({
      loading: false,
      error: (err as { message?: string })?.message ?? 'Failed to load dashboard data.',
      tasks: [], recentClaims: [], stats: { total: 0, opened: 0, closed: 0 },
      quickLinks: QUICK_LINKS, portfolioTab: 'claims' as const, urgentApprovals: [],
    }))
  );
  private readonly vm = toSignal(this.vm$, { initialValue: EMPTY_VM });

  // ── Extended data ────────────────────────────────────────────────────
  readonly headsUp$          = this.extSvc.getHeadsUp();
  readonly news$             = this.extSvc.getNews();
  readonly calendarEvents$   = this.extSvc.getCalendarEvents();
  readonly providerExpenses$ = this.extSvc.getProviderExpenses();
  readonly closurePeriod$    = this.extSvc.getFinancialClosurePeriod();
  readonly reserveMovements$ = this.extSvc.getReserveMovements();
  readonly lossEvents$       = this.extSvc.getLossEvents();
  readonly paymentApprovals$ = this.extSvc.getPaymentApprovals();

  readonly headsUp          = toSignal(this.headsUp$,          { initialValue: [] });
  readonly news             = toSignal(this.news$,             { initialValue: [] });
  readonly calendarEvents   = toSignal(this.calendarEvents$,   { initialValue: [] });
  readonly providerExpenses = toSignal(this.providerExpenses$, { initialValue: [] });
  readonly closurePeriod    = toSignal(this.closurePeriod$,    {
    initialValue: { active: false, start: '', end: '', message: '' }
  });
  readonly reserveMovements = toSignal(this.reserveMovements$, { initialValue: [] as ReserveMovement[] });
  readonly lossEvents       = toSignal(this.lossEvents$,       { initialValue: [] as LossEventSummary[] });
  readonly paymentApprovals = toSignal(this.paymentApprovals$, { initialValue: [] as PaymentApproval[] });

  // ── Filtered display lists ────────────────────────────────────────────
  readonly displayedTasks = computed<Task[]>(() => {
    const tasks = this.vm().tasks;
    const name  = this.auth.user()?.name ?? '';
    const filtered = this.showMyTasksOnly()
      ? tasks.filter(t => t.assignee === name)
      : tasks;
    return filtered.slice(0, 7);
  });

  // Claims created within the selected date range — feeds both the portfolio widget and the stats card,
  // per the alignment doc's ask for a single shared default date range across both.
  readonly dateRangedClaims = computed<Claim[]>(() => {
    const claims = this.vm().recentClaims;
    const range = this.claimsDateRange();
    if (range === 'all') return claims;
    const days = range === '30' ? 30 : 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return claims.filter(c => new Date(c.dateCreated) >= cutoff);
  });

  readonly dateRangedStats = computed<ClaimStats>(() => this.buildStats(this.dateRangedClaims()));

  claimsDateRangeLabel(): string {
    const range = this.claimsDateRange();
    return range === 'all' ? 'All time' : `Last ${range} days`;
  }


  // ── KPI data (KCM) ───────────────────────────────────────────────────
  // ⚑ €50k threshold — confirm with business; 7-day window is also a placeholder
  private readonly BIG_RESERVE_THRESHOLD = 50000;
  private readonly RESERVE_WINDOW_DAYS   = 7;

  readonly kpiData = computed(() => {
    const allClaims    = this.vm().recentClaims;
    const allApprovals = this.vm().urgentApprovals;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.RESERVE_WINDOW_DAYS);
    const bigMovements = this.reserveMovements().filter(r =>
      r.delta >= this.BIG_RESERVE_THRESHOLD &&
      new Date(r.date) >= cutoff
    ).length;
    return {
      openClaims:          allClaims.filter(c => c.status === 'Open' || c.status === 'In progress').length,
      pendingApprovals:    allApprovals.length,
      bigReserveMovements: bigMovements,
    };
  });

  // ── Overdue helper (tasks widget) ──────────────────────────────────────
  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  }

  daysSinceUpdate(dateUpdated: string): number {
    return Math.floor((Date.now() - new Date(dateUpdated).getTime()) / 86400000);
  }

  setClaimsDateRange(range: ClaimsDateRange): void {
    this.claimsDateRange.set(range);
    localStorage.setItem('dashboard:claims-date-range', range);
  }

  navigateToFnol(): void { this.router.navigate(['/fnol/search']); }
  navigateToSearch(): void { this.router.navigate(['/fnol/search']); }

  initials(): string {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  roleBadgeLabel(): string {
    const role = this.auth.user()?.dashboardRole;
    if (role === 'kcm') return 'Key Case Manager';
    return 'Claims Handler';
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
