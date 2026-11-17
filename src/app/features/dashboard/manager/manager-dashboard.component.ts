import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { Navbar } from '../../layout/navbar/navbar';
import { AuthService } from '../../../core/services/auth';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockTeamService } from '../../../core/mock/services/mock-team.service';
import { MockUserDirectoryService } from '../../../core/mock/services/mock-user-directory.service';
import { ManagedCase } from '../../../core/models/team.model';
import { KpiTile } from '../../../core/models';
import { KpiRowComponent } from '../widgets/kpi-row';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import {
  ReassignClaimModalComponent,
  ReassignClaimModalData,
  ReassignClaimModalResult
} from '../../../shared/components/reassign-claim-modal/reassign-claim-modal.component';
import { buildCases, summarize } from './manager-cases.builder';
import { ManagerCaseTableComponent } from './manager-case-table.component';
import { TeamWorkloadComponent, TeamFilters } from './team-workload.component';

// DESIGN DECISION CM-REFRESH-1 (open question 6): data loads when the page
// opens and on "Refresh". No live polling, so rows don't move while the
// manager reads them. Data older than 15 minutes is marked as possibly out
// of date with a Refresh action.
const STALE_AFTER_MS = 15 * 60_000;
const LOAD_MS = 500;

// BMPCC-22395: the Claims Manager dashboard. Own cases on top, the direct
// team below. Same page shell, cards and tables as the handler dashboard
// (dashboard.scss is shared, not copied), which itself is unchanged.
@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    Navbar,
    RouterLink,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxMessageModule,
    KpiRowComponent,
    EmptyStateComponent,
    AppDatePipe,
    ManagerCaseTableComponent,
    TeamWorkloadComponent
  ],
  templateUrl: './manager-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../dashboard.scss', './manager-dashboard.component.scss']
})
export class ManagerDashboardComponent {
  readonly auth = inject(AuthService);
  private readonly stateSvc = inject(MockStateService);
  private readonly teamSvc = inject(MockTeamService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly sim = computed(() => this.teamSvc.simulation().managerDashboard);
  readonly noPermission = computed(() => this.sim() === 'no-permission');

  readonly loading = signal(true);
  // CM-REFRESH-1: Refresh keeps the rows on screen; only the Refresh link
  // turns into a spinner (same as "Sync now", tracker-table.component.html:13-17).
  readonly refreshing = signal(false);
  readonly loadError = signal(false);
  readonly loadedAt = signal<Date>(new Date());
  private readonly now = signal(Date.now());
  private staleSimUsed = false;

  readonly isStale = computed(
    () => this.now() - this.loadedAt().getTime() > STALE_AFTER_MS
  );

  readonly team = computed(() => {
    const t = this.teamSvc.teamManagedBy(this.auth.user().name);
    if (!t) return null;
    return this.sim() === 'no-team' ? { ...t, memberNames: [] } : t;
  });

  // Partial data: one member's cases didn't load.
  readonly missing = computed(
    () => new Set<string>(this.sim() === 'partial' ? ['Dirk Haas'] : [])
  );

  private readonly cases = computed(() => {
    if (this.sim() === 'no-cases') return { own: [], team: [] };
    const st = this.stateSvc.state();
    const all = buildCases(
      st.claims,
      st.tasks,
      this.teamSvc.reviewFlags(),
      this.team(),
      this.auth.user().name
    );
    const missing = this.missing();
    return { own: all.own, team: all.team.filter(c => !missing.has(c.owner)) };
  });

  readonly ownCases = computed(() => this.cases().own);
  readonly teamCases = computed(() => this.cases().team);
  readonly members = computed(() => summarize(this.teamCases(), this.team(), this.missing()));

  // Who is away, from the same user directory the reassign dialog reads
  // (mock-assignment.service.ts targets(): outOfOfficeUntil).
  private readonly directory = toSignal(inject(MockUserDirectoryService).getAll(), {
    initialValue: []
  });
  readonly away = computed(
    () =>
      new Map(
        this.directory()
          .filter(u => !!u.outOfOfficeUntil)
          .map(u => [u.name, u.outOfOfficeUntil as string])
      )
  );

  readonly counts = computed(() => {
    const open = this.teamCases().filter(c => c.claim.status === 'Open');
    return {
      open: open.length,
      flagged: open.filter(c => c.flags.length).length,
      overdue: open.filter(c => c.flags.some(f => f.kind === 'overdue')).length,
      highValue: open.filter(c => c.flags.some(f => f.kind === 'high-value')).length,
      review: open.filter(c => c.flags.some(f => f.kind === 'review')).length
    };
  });

  readonly kpiTiles = computed<KpiTile[]>(() => {
    const c = this.counts();
    return [
      { key: 'all', value: c.open, label: 'Open team claims', icon: 'product-board-paper-note' },
      { key: 'any', value: c.flagged, label: 'Need attention', icon: 'product-important-info' },
      { key: 'overdue', value: c.overdue, label: 'Overdue', icon: 'product-clock' },
      { key: 'high-value', value: c.highValue, label: 'High value', icon: 'product-coins-money' },
      { key: 'review', value: c.review, label: 'For review', icon: 'product-check-paper' }
    ];
  });

  // Filters live in the URL so Back from a claim returns to the same view.
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });
  readonly filters = computed<TeamFilters>(() => {
    const p = this.params();
    return {
      member: p.get('member'),
      status: (p.get('status') as TeamFilters['status']) ?? 'Open',
      flag: (p.get('flag') as TeamFilters['flag']) ?? 'all'
    };
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Load on open, and again when the dev banner switches the simulated state.
    effect(() => {
      this.sim();
      untracked(() => void this.load());
    });
  }

  /** First load (and Try again) shows the page spinner. */
  async load(): Promise<void> {
    if (this.sim() !== 'stale') this.staleSimUsed = false;
    this.loading.set(true);
    this.loadError.set(false);
    if (this.sim() === 'loading') return;
    await this.fetch();
  }

  /** Refresh / Refresh now: the page stays as it is, only the numbers update. */
  async refresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    await new Promise(r => setTimeout(r, LOAD_MS));
    this.loading.set(false);
    this.refreshing.set(false);
    if (this.sim() === 'error') {
      this.loadError.set(true);
      return;
    }
    this.now.set(Date.now());
    // Stale demo: the first load pretends the data is two hours old;
    // Refresh then brings it up to date like a real reload would.
    if (this.sim() === 'stale' && !this.staleSimUsed) {
      this.staleSimUsed = true;
      this.loadedAt.set(new Date(Date.now() - 2 * 3600_000));
      return;
    }
    this.loadedAt.set(new Date());
  }

  setFilters(f: Partial<TeamFilters>): void {
    const next = { ...this.filters(), ...f };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        member: next.member || null,
        status: next.status === 'Open' ? null : next.status,
        flag: next.flag === 'all' ? null : next.flag
      },
      replaceUrl: true
    });
  }

  // A summary number filters the team list and brings that list (not the
  // card above it) into view, so the result of the click is on screen.
  showFlag(key: string): void {
    this.setFilters({ member: null, status: 'Open', flag: key as TeamFilters['flag'] });
    const list = document.getElementById('mgr-team-cases');
    list?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    list?.focus({ preventScroll: true });
  }

  // "View all claims" carries the list's filters onto the claims list, like the
  // Claims portfolio widget's viewAllClaimsParams (claims-portfolio-widget.component.ts:144).
  // The claims list filters by one handler and one status; it has no team or
  // flag filter, so those are not carried.
  readonly viewAllParams = computed<Record<string, string>>(() => {
    const f = this.filters();
    const params: Record<string, string> = {};
    if (f.member && f.member !== 'Team queue') params['assignee'] = f.member;
    if (f.status !== 'all') params['status'] = f.status;
    return params;
  });

  // DESIGN DECISION CM-ACT-1 (open question 4): the dashboard is for spotting
  // and opening claims. The one action on it is Reassign, because it reuses
  // the BMPCC-22666 dialog (same rules, confirm and notifications as
  // everywhere else). Escalating or adding a note happens on the claim.
  async reassign(mc: ManagedCase): Promise<void> {
    const c = mc.claim;
    const ref = this.dialogSvc.open(ReassignClaimModalComponent, {
      data: {
        claims: [
          {
            claimId: c.claimId,
            clientName: c.clientName,
            owner: c.assignee,
            group: c.group ?? null,
            status: c.status,
            lossAmount: c.lossAmount,
            currency: c.currency
          }
        ]
      } satisfies ReassignClaimModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as ReassignClaimModalResult | null;
    if (!result?.saved) return;
    this.toast.success(
      'Claim reassigned',
      `${c.claimId} is now with ${result.saved.targetLabel}. Both handlers have been notified.`
    );
  }

  goTo(path: string): void {
    void this.router.navigate([path]);
  }

  goToClaims(): void {
    void this.router.navigate(['/claims'], { queryParams: { assignee: 'me' } });
  }
}
