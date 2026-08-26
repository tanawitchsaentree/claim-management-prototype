import { Component, inject, OnDestroy, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { ClaimPreviewDirective } from '../../../shared/directives/claim-preview.directive';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockTaskService } from '../../../core/mock/services/mock-task.service';
import { MockMassEventService } from '../../../core/mock/services/mock-mass-event.service';
import { ClaimClosureService } from '../../../core/services/claim-closure.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { ScenarioStageService } from '../../../core/scenario/scenario-stage.service';
import { OverviewStage, ClosureReason as StageClosureReason } from '../../../core/scenario/scenario-stage.model';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ClaimOverview, ClaimActivity } from '../../../core/models/claim-overview.model';
import { BlockerCheckResult } from '../../../core/models/claim-closure.model';
import { MassEvent } from '../../../core/models/mass-event.model';
import { Task } from '../../../core/models/task.model';
import {
  ClaimClosureModalComponent,
  ClaimClosureModalResult,
} from './components/claim-closure-modal/claim-closure-modal.component';
import {
  ClaimReopenModalComponent,
  ClaimReopenModalResult,
} from './components/claim-reopen-modal/claim-reopen-modal.component';
import { FileRestriction } from '../../../core/models/claim-overview.model';
import { RecoveryPotentialCardComponent, RecoveryPotentialUpdated } from './components/recovery-potential-card/recovery-potential-card.component';
import { FileRestrictionCardComponent } from './components/file-restriction-card/file-restriction-card.component';
import { MassEventCardComponent, MassEventChanged } from './components/mass-event-card/mass-event-card.component';
import { PendingTasksWidgetComponent } from './components/pending-tasks-widget/pending-tasks-widget.component';
import { RecentActivitiesCardComponent } from './components/recent-activities-card/recent-activities-card.component';
import {
  ReassignClaimModalComponent,
  ReassignClaimModalData,
  ReassignClaimModalResult,
} from '../../../shared/components/reassign-claim-modal/reassign-claim-modal.component';

interface OverviewVM {
  loading: boolean;
  error: string | null;
  claim: ClaimOverview | null;
  activities: ClaimActivity[];
  activitiesExpanded: boolean;
  tasks: Task[];
  tasksExpanded: boolean;
  massEvent: MassEvent | null;
}

const EMPTY_VM: OverviewVM = {
  loading: true,
  error: null,
  claim: null,
  activities: [],
  activitiesExpanded: false,
  tasks: [],
  tasksExpanded: true,
  massEvent: null,
};

@Component({
  selector: 'app-claim-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NxIconModule,
    NxButtonModule,
    NxSpinnerModule,
    NxTooltipModule,
    NxLinkModule,
    NxMessageModule,
    NxModalModule,
    StatusChipComponent,
    AppDatePipe,
    ClaimPreviewDirective,
    RecoveryPotentialCardComponent,
    FileRestrictionCardComponent,
    MassEventCardComponent,
    PendingTasksWidgetComponent,
    RecentActivitiesCardComponent,
  ],
  templateUrl: './claim-overview.component.html',
  styleUrl: './claim-overview.component.scss',
})
export class ClaimOverviewComponent implements OnInit, OnDestroy, OverviewStage {
  readonly page = 'overview' as const;
  claimId: string | undefined;

  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly overviewSvc    = inject(MockClaimOverviewService);
  private readonly taskSvc        = inject(MockTaskService);
  private readonly closureSvc     = inject(ClaimClosureService);
  private readonly stateSvc       = inject(MockStateService);
  private readonly stageSvc       = inject(ScenarioStageService);
  private readonly dialogSvc      = inject(NxDialogService);
  private readonly massEventSvc   = inject(MockMassEventService);
  private readonly toast          = inject(ToastService);
  private readonly sectionSvc    = inject(MockSectionService);
  private deregisterStage: (() => void) | null = null;

  readonly vm$ = new BehaviorSubject<OverviewVM>(EMPTY_VM);

  readonly closureCheck = signal<BlockerCheckResult | null>(null);
  readonly closedSectionsCount = signal<number>(0);

  private readonly paramMap = toSignal(this.route.paramMap);
  private loadGeneration = 0;

  constructor() {
    // Reactivity bridge: reload whenever the route param OR the mock-state
    // signal changes (dev-banner Apply mutates state; this must re-run).
    effect(() => {
      const params = this.paramMap();
      this.stateSvc.state();
      if (!params) return;
      void this.loadOverview(params.get('id') ?? 'CL-2025-001');
    });
  }

  ngOnInit(): void {
    this.deregisterStage = this.stageSvc.register(this);
  }

  private async loadOverview(claimId: string): Promise<void> {
    const generation = ++this.loadGeneration;
    this.claimId = claimId;
    this.vm$.next(EMPTY_VM);
    try {
      const [overview, tasks, closure] = await Promise.all([
        firstValueFrom(this.overviewSvc.getOverviewWithActivities(claimId)),
        firstValueFrom(this.taskSvc.getByClaimId(claimId)),
        firstValueFrom(this.closureSvc.validateBlockers(claimId)),
      ]);
      const massEventId = overview.claim?.massEventId;
      const massEvent = massEventId ? await firstValueFrom(this.massEventSvc.getById(massEventId)) : null;

      if (generation !== this.loadGeneration) return; // stale — a newer load superseded this one

      this.closureCheck.set(closure);
      this.vm$.next({
        loading: false, error: null,
        claim: overview.claim,
        activities: overview.activities,
        activitiesExpanded: false,
        tasks,
        tasksExpanded: true,
        massEvent: massEvent ?? null,
      });
      if (overview.claim) {
        this.refreshClosedSectionsCount(overview.claim.claimId);
      }
    } catch {
      if (generation !== this.loadGeneration) return;
      this.vm$.next({ ...EMPTY_VM, loading: false, error: 'Failed to load claim overview.', massEvent: null });
    }
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

  private refreshClosedSectionsCount(claimId: string): void {
    firstValueFrom(this.sectionSvc.getByClaimId(claimId))
      .then(secs => this.closedSectionsCount.set(secs.filter(s => s.status === 'Closed').length))
      .catch(() => this.closedSectionsCount.set(0));
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

  async openClosureModal(claim: ClaimOverview): Promise<void> {
    const check = this.closureCheck();
    if (!check) return;

    const ref = this.dialogSvc.open(ClaimClosureModalComponent, {
      data: { claim, blockers: check },
      width: '600px',
      maxWidth: '92vw',
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

  onRecoveryUpdated({ claim, activity }: RecoveryPotentialUpdated): void {
    const cur = this.vm$.value;
    if (!cur.claim) return;
    this.vm$.next({
      ...cur,
      claim: { ...cur.claim, recoveryPotential: claim.recoveryPotential, recoveryPotentialNote: claim.recoveryPotentialNote },
      activities: [activity, ...cur.activities],
    });
  }

  onRestrictionChanged(restriction: FileRestriction): void {
    const cur = this.vm$.value;
    if (!cur.claim) return;
    this.vm$.next({ ...cur, claim: { ...cur.claim, restriction } });
  }

  async openReassignModal(claim: ClaimOverview): Promise<void> {
    const ref = this.dialogSvc.open(ReassignClaimModalComponent, {
      data: {
        claimIds: [claim.claimId],
        currentHandler: claim.assignedHandler,
        claims: [{ claimId: claim.claimId, clientName: claim.client, currentHandler: claim.assignedHandler }],
      } satisfies ReassignClaimModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as ReassignClaimModalResult | null | undefined;
    if (!result) return;
    const cur = this.vm$.value;
    if (!cur.claim) return;
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: claim.claimId,
      user: claim.assignedHandler,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Assigned Claim handler',
      valueOld: claim.assignedHandler,
      valueNew: result.reason ? `${result.handlerName} — ${result.reason}` : result.handlerName,
    };
    this.vm$.next({
      ...cur,
      claim: { ...cur.claim, assignedHandler: result.handlerName },
      activities: [activity, ...cur.activities],
    });
    this.toast.success('Claim reassigned', `${claim.claimId} is now assigned to ${result.handlerName}`);
  }

  async openReopenModal(claim: ClaimOverview): Promise<void> {
    const ref = this.dialogSvc.open(ClaimReopenModalComponent, {
      data: { claim },
      width: '600px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as ClaimReopenModalResult | undefined;
    if (!result) return;

    const cur = this.vm$.value;
    const activity: ClaimActivity = {
      id:         `act-${Date.now()}`,
      claimId:    claim.claimId,
      user:       claim.assignedHandler,
      timestamp:  new Date().toISOString(),
      objectType: 'Claim',
      attribute:  'Status',
      valueOld:   claim.status,
      valueNew:   'Open',
    };
    this.vm$.next({
      ...cur,
      claim: result.reopenedClaim,
      activities: [activity, ...cur.activities],
    });

    const allSections = await firstValueFrom(this.sectionSvc.getByClaimId(claim.claimId)).catch(() => []);
    const remainingAfter = allSections.filter(s => s.status === 'Closed').length;
    const reopened = result.reopenedSectionIds.length;

    let subtitle = result.reopenedClaim.claimId;
    if (reopened > 0 && remainingAfter > 0) {
      subtitle = `${reopened} section${reopened > 1 ? 's' : ''} reopened. ${remainingAfter} section${remainingAfter > 1 ? 's' : ''} remain closed.`;
    } else if (reopened > 0) {
      subtitle = `${reopened} section${reopened > 1 ? 's' : ''} reopened.`;
    }
    const action = reopened > 0
      ? { label: 'View sections', onClick: () => this.router.navigate(['/claims', claim.claimId, 'sections']) }
      : undefined;
    this.toast.success('Claim reopened', subtitle, action);
    this.refreshClosedSectionsCount(claim.claimId);
  }

  toggleActivities(): void {
    const cur = this.vm$.value;
    this.vm$.next({ ...cur, activitiesExpanded: !cur.activitiesExpanded });
  }

  toggleTasks(): void {
    const cur = this.vm$.value;
    this.vm$.next({ ...cur, tasksExpanded: !cur.tasksExpanded });
  }

  riskSeverity(score: number): 'high' | 'medium' | 'low' {
    if (score >= 4) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  onMassEventChanged(event: MassEventChanged): void {
    const cur = this.vm$.value;
    if (cur.claim?.claimId !== event.claimId) return; // stale — a newer load superseded this one
    this.vm$.next({
      ...cur,
      claim: { ...cur.claim, massEventId: event.massEventId, massEventLinkStatus: event.massEventLinkStatus },
      massEvent: event.massEvent,
    });
  }
}
