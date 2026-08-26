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
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { StatusChipComponent } from '../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { ClaimPreviewDirective } from '../../shared/directives/claim-preview.directive';
import { MockTaskService } from '../../core/mock/services/mock-task.service';
import { MockClaimService } from '../../core/mock/services/mock-claim.service';
import { MockApprovalService } from '../../core/mock/services/mock-approval.service';
import { MockDashboardExtendedService } from '../../core/mock/services/mock-dashboard-extended.service';
import { AuthService } from '../../core/services/auth';
import { Claim, ClaimStats, DashboardVM, QuickLink, Task, UrgentApproval, ReserveMovement, LossEventSummary, PaymentApproval } from '../../core/models';

import { Navbar } from '../layout/navbar/navbar';

// Widgets
import { FinancialClosureBannerComponent } from './widgets/financial-closure-banner';
import { KpiRowComponent } from './widgets/kpi-row';
import { HeadsUpPanelComponent } from './widgets/heads-up-panel';
import { CalendarWidgetComponent } from './widgets/calendar-widget';
import { NewsPanelComponent } from './widgets/news-panel';
import { ExpenseBreakdownComponent } from './widgets/expense-breakdown';

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

const DORMANT_DAYS = 30; // ⚑ PLACEHOLDER — confirm threshold with business

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    NxButtonModule, NxIconModule, NxSpinnerModule, NxSwitcherModule, NxBadgeModule, NxTableModule, NxContextMenuModule,
    StatusChipComponent, EmptyStateComponent, Navbar, ClaimPreviewDirective,
    FinancialClosureBannerComponent, KpiRowComponent, HeadsUpPanelComponent,
    CalendarWidgetComponent, NewsPanelComponent, ExpenseBreakdownComponent,
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
  readonly showMyApprovalsOnly = signal(false);
  // Default scope is "My claims" for a Claims Handler (the ticket's core ask — a unified view of
  // claims assigned to them) and "All" for a KCM, who oversees more than their own portfolio.
  readonly claimsScope         = signal<'mine' | 'group' | 'all'>(
    (localStorage.getItem('dashboard:claims-scope') as 'mine' | 'group' | 'all')
    ?? (this.auth.isKcm() ? 'all' : 'mine')
  );
  // Default view is "Open Claims" per PI 2026.3 UI/UX alignment (BMPCC-15121) — Open/In progress only,
  // with a filter to widen to Closed/Declined or everything.
  readonly claimsStatusFilter  = signal<'open' | 'closed' | 'all'>(
    (localStorage.getItem('dashboard:claims-status-filter') as 'open' | 'closed' | 'all') ?? 'open'
  );
  // ⚑ PLACEHOLDER default (Last 30 days) — the alignment doc raised "what is the default date
  // range on landing" as an open question with no business answer yet; confirm before launch.
  readonly claimsDateRange     = signal<'30' | '90' | 'all'>(
    (localStorage.getItem('dashboard:claims-date-range') as '30' | '90' | 'all') ?? '30'
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

  readonly displayedApprovals = computed<UrgentApproval[]>(() => {
    const approvals = this.vm().urgentApprovals;
    if (!this.showMyApprovalsOnly()) return approvals;
    const name = this.auth.user()?.name ?? '';
    return approvals.filter(a => a.requester === name);
  });

  // Recent approval requests — tab between reserve approvals and payment approvals.
  readonly approvalsTab = signal<'reserves' | 'payments'>('reserves');

  readonly displayedPayments = computed<PaymentApproval[]>(() => {
    const payments = this.paymentApprovals();
    if (!this.showMyApprovalsOnly()) return payments;
    const name = this.auth.user()?.name ?? '';
    return payments.filter(p => p.requester === name);
  });

  readonly displayedClaims = computed<Claim[]>(() => {
    const claims = this.dateRangedClaims();
    const scope  = this.claimsScope();
    const status = this.claimsStatusFilter();
    const user   = this.auth.user();
    let filtered = claims;
    if (user) {
      if (scope === 'mine')       filtered = filtered.filter(c => c.assignee === user.name);
      else if (scope === 'group') filtered = filtered.filter(c => c.group === user.group);
    }
    if (status === 'open')        filtered = filtered.filter(c => c.status === 'Open' || c.status === 'In progress');
    else if (status === 'closed') filtered = filtered.filter(c => c.status === 'Closed' || c.status === 'Declined');
    // No fallback to unfiltered claims when a scope/status combination yields zero rows —
    // an empty result is real and must render the empty state, not someone else's claims.
    return filtered.slice(0, 5);
  });

  // Claims created within the selected date range — feeds both the portfolio widget and the stats card,
  // per the alignment doc's ask for a single shared default date range across both.
  private readonly dateRangedClaims = computed<Claim[]>(() => {
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

  // ── Portfolio tab ────────────────────────────────────────────────────
  portfolioTab: 'claims' | 'loss-events' = 'claims';

  // ── Overdue / dormant helpers ─────────────────────────────────────────
  isOverdue(dueDate: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  }

  isDormant(dateUpdated: string): boolean {
    if (!dateUpdated) return false;
    const diff = (Date.now() - new Date(dateUpdated).getTime()) / 86400000;
    return diff > DORMANT_DAYS;
  }

  daysSinceUpdate(dateUpdated: string): number {
    return Math.floor((Date.now() - new Date(dateUpdated).getTime()) / 86400000);
  }

  setPortfolioTab(tab: 'claims' | 'loss-events'): void { this.portfolioTab = tab; }
  setApprovalsTab(tab: 'reserves' | 'payments'): void { this.approvalsTab.set(tab); }

  setClaimsScope(scope: 'mine' | 'group' | 'all'): void {
    this.claimsScope.set(scope);
    localStorage.setItem('dashboard:claims-scope', scope);
  }

  setClaimsStatusFilter(status: 'open' | 'closed' | 'all'): void {
    this.claimsStatusFilter.set(status);
    localStorage.setItem('dashboard:claims-status-filter', status);
  }

  setClaimsDateRange(range: '30' | '90' | 'all'): void {
    this.claimsDateRange.set(range);
    localStorage.setItem('dashboard:claims-date-range', range);
  }

  // "View all claims" carries the widget's current scope onto the claims list, so a handler
  // viewing "My claims" lands on their own filtered list instead of the generic unfiltered one.
  // (Status isn't carried over: the widget's Open/Closed/All is a status *group*, while the
  // claims list filters by one exact ClaimStatus — the two aren't a clean 1:1 mapping.)
  readonly viewAllClaimsParams = computed<Record<string, string>>(() => {
    const params: Record<string, string> = {};
    if (this.claimsScope() === 'mine') params['assignee'] = 'me';
    return params;
  });

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
