import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ClaimOverview, ClaimActivity } from '../../../core/models/claim-overview.model';
import { BlockerCheckResult } from '../../../core/models/claim-closure.model';
import { Task } from '../../../core/models/task.model';
import {
  ClaimClosureModalComponent,
  ClaimClosureModalResult,
} from './components/claim-closure-modal/claim-closure-modal.component';

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
export class ClaimOverviewComponent implements OnInit {
  private readonly route          = inject(ActivatedRoute);
  private readonly overviewSvc    = inject(MockClaimOverviewService);
  private readonly taskSvc        = inject(MockTaskService);
  private readonly closureSvc     = inject(ClaimClosureService);
  private readonly dialogSvc      = inject(NxDialogService);
  private readonly destroyRef     = inject(DestroyRef);

  readonly vm$ = new BehaviorSubject<OverviewVM>(EMPTY_VM);
  readonly tasksPageSize = TASKS_PAGE_SIZE;
  tasksPage = 1;

  readonly closureCheck = signal<BlockerCheckResult | null>(null);

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
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
    console.log('[ClaimOverview] Claim closed:', result.closedClaim.claimId);
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
