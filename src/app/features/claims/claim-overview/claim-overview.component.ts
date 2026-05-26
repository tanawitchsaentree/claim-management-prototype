import { Component, inject, OnDestroy, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, combineLatest, firstValueFrom, switchMap } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockTaskService } from '../../../core/mock/services/mock-task.service';
import { ClaimClosureService } from '../../../core/services/claim-closure.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { ScenarioStageService } from '../../../core/scenario/scenario-stage.service';
import { OverviewStage, ClosureReason as StageClosureReason } from '../../../core/scenario/scenario-stage.model';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ClaimOverview, ClaimActivity } from '../../../core/models/claim-overview.model';
import { BlockerCheckResult } from '../../../core/models/claim-closure.model';
import { Task } from '../../../core/models/task.model';
import {
  ClaimClosureModalComponent,
  ClaimClosureModalResult,
} from './components/claim-closure-modal/claim-closure-modal.component';
import {
  ClaimReopenModalComponent,
  ClaimReopenModalResult,
} from './components/claim-reopen-modal/claim-reopen-modal.component';

interface OverviewVM {
  loading: boolean;
  error: string | null;
  claim: ClaimOverview | null;
  activities: ClaimActivity[];
  activitiesExpanded: boolean;
  tasks: Task[];
  tasksExpanded: boolean;
}

const EMPTY_VM: OverviewVM = {
  loading: true,
  error: null,
  claim: null,
  activities: [],
  activitiesExpanded: false,
  tasks: [],
  tasksExpanded: true,
};

const TASKS_PAGE_SIZE = 10;

@Component({
  selector: 'app-claim-overview',
  standalone: true,
  imports: [
    CommonModule,
    NxIconModule,
    NxButtonModule,
    NxSpinnerModule,
    NxTableModule,
    NxPaginationModule,
    NxTooltipModule,
    NxModalModule,
    StatusChipComponent,
  ],
  templateUrl: './claim-overview.component.html',
  styleUrl: './claim-overview.component.scss',
})
export class ClaimOverviewComponent implements OnInit, OnDestroy, OverviewStage {
  readonly page = 'overview' as const;

  private readonly route          = inject(ActivatedRoute);
  private readonly overviewSvc    = inject(MockClaimOverviewService);
  private readonly taskSvc        = inject(MockTaskService);
  private readonly closureSvc     = inject(ClaimClosureService);
  private readonly stateSvc       = inject(MockStateService);
  private readonly stageSvc       = inject(ScenarioStageService);
  private readonly dialogSvc      = inject(NxDialogService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly toast          = inject(ToastService);
  private deregisterStage: (() => void) | null = null;

  readonly vm$ = new BehaviorSubject<OverviewVM>(EMPTY_VM);
  readonly tasksPageSize = TASKS_PAGE_SIZE;
  tasksPage = 1;

  readonly closureCheck = signal<BlockerCheckResult | null>(null);

  readonly massEventTooltip =
    'ME-2025.102 — Storm Bernd (Munich region)\n' +
    'Cluster of 142 linked claims · Opened 04 May 2025\n' +
    'Linked claims share reserves treaty and CAT code.';

  private readonly state$ = toObservable(this.stateSvc.state);

  ngOnInit(): void {
    // Register the stage immediately so postLand hooks can find this component
    // even if they fire before the first vm$ update (race-condition fix).
    this.deregisterStage = this.stageSvc.register(this);

    combineLatest([
      this.route.paramMap,
      this.state$,
    ]).pipe(
      switchMap(([params]) => {
        const claimId = params.get('id') ?? 'CL-2025-001';
        this.vm$.next(EMPTY_VM);
        return combineLatest({
          overview: this.overviewSvc.getOverviewWithActivities(claimId),
          tasks:    this.taskSvc.getByClaimId(claimId),
          closure:  this.closureSvc.validateBlockers(claimId),
        });
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ overview, tasks, closure }) => {
        this.closureCheck.set(closure);
        this.vm$.next({
          loading: false, error: null,
          claim: overview.claim,
          activities: overview.activities,
          activitiesExpanded: false,
          tasks,
          tasksExpanded: true,
        });
      },
      error: () =>
        this.vm$.next({ ...EMPTY_VM, loading: false, error: 'Failed to load claim overview.' }),
    });
  }

  // Wait until vm$ has a non-null claim (async data still in flight when
  // the stage hook fires straight after route navigate).
  private async waitForClaim(timeoutMs = 4000): Promise<ClaimOverview | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const c = this.vm$.value.claim;
      if (c) return c;
      await new Promise(r => setTimeout(r, 50));
    }
    return null;
  }

  ngOnDestroy(): void {
    this.deregisterStage?.();
  }

  // ── Stage hooks ────────────────────────────────────────────────────
  async openClosureModalAuto(): Promise<void> {
    const claim = await this.waitForClaim();
    if (!claim) {
      console.warn('[stage] openClosureModalAuto — claim not loaded within timeout');
      return;
    }
    // Also make sure closureCheck has resolved (validateBlockers async)
    const start = Date.now();
    while (this.closureCheck() === null && Date.now() - start < 4000) {
      await new Promise(r => setTimeout(r, 50));
    }
    await this.openClosureModal(claim);
  }

  async confirmClosure(reason: StageClosureReason): Promise<void> {
    const claim = await this.waitForClaim();
    const check = this.closureCheck();
    if (!claim || !check?.canClose) return;
    const closedClaim = await firstValueFrom(this.closureSvc.closeClaim(claim.claimId, {
      reason,
      retentionType: 'default',
      confirmedBy: { userId: 'usr-current', name: claim.assignedHandler },
    }));
    const now = new Date().toISOString();
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: now,
      objectType: 'Claim',
      attribute: 'Status',
      valueOld: claim.status,
      valueNew: 'Closed',
    };
    const cur = this.vm$.value;
    this.vm$.next({
      ...cur,
      claim: closedClaim,
      activities: [activity, ...cur.activities],
    });
    this.closureCheck.set({ canClose: false, blockers: [] });
  }

  closureTooltip(): string {
    const check = this.closureCheck();
    if (!check || check.canClose) return '';
    const parts = check.blockers
      .filter(b => b.count != null && b.count > 0)
      .map(b => `${b.count} ${b.type === 'tasks' ? 'pending task(s)' : 'open section(s)'}`);
    if (parts.length) return `Cannot close: ${parts.join(', ')}`;
    return `Cannot close: ${check.blockers.length} blocker(s) must be resolved`;
  }

  async openClosureModal(claim: ClaimOverview): Promise<void> {
    const check = this.closureCheck();
    if (!check) return;

    const ref = this.dialogSvc.open(ClaimClosureModalComponent, {
      data: { claim, blockers: check },
      width: '560px',
    });

    const result = await firstValueFrom(ref.afterClosed()) as ClaimClosureModalResult | undefined;
    if (!result) return;

    const cur = this.vm$.value;
    this.vm$.next({
      ...cur,
      claim: result.closedClaim,
      activities: [result.activity, ...cur.activities],
    });
    this.closureCheck.set({ canClose: false, blockers: [] });
    this.toast.success('Claim closed', `${result.closedClaim.claimId} — ${result.closedClaim.closureReason}`);
  }

  async openReopenModal(claim: ClaimOverview): Promise<void> {
    const ref = this.dialogSvc.open(ClaimReopenModalComponent, {
      data: { claim },
      width: '640px',
      maxWidth: '95vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as ClaimReopenModalResult | undefined;
    if (!result) return;
    const cur = this.vm$.value;
    this.vm$.next({ ...cur, claim: result.reopenedClaim });
    this.toast.success('Claim reopened', result.reopenedClaim.claimId);
  }

  toggleActivities(): void {
    const cur = this.vm$.value;
    this.vm$.next({ ...cur, activitiesExpanded: !cur.activitiesExpanded });
  }

  toggleTasks(): void {
    const cur = this.vm$.value;
    this.vm$.next({ ...cur, tasksExpanded: !cur.tasksExpanded });
  }

  riskClass(score: number): string {
    if (score >= 4) return 'risk-high';
    if (score >= 3) return 'risk-medium';
    return 'risk-low';
  }

  priorityDotClass(priority: string): string {
    return `dot--${priority}`;
  }

  taskCountByPriority(tasks: Task[], priority: string): number {
    return tasks.filter(t => t.priority === priority).length;
  }

  formatAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
  }

  pagedTasks(tasks: Task[]): Task[] {
    const start = (this.tasksPage - 1) * TASKS_PAGE_SIZE;
    return tasks.slice(start, start + TASKS_PAGE_SIZE);
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y.slice(2)}`;
  }
}
