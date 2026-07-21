import { Component, inject, OnDestroy, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BehaviorSubject, combineLatest, firstValueFrom, of, switchMap } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxPaginationModule } from '@allianz/ng-aquila/pagination';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { MockUserDirectoryService, UserDirectoryEntry } from '../../../core/mock/services/mock-user-directory.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
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
import {
  MassEventEditModalComponent,
  MassEventModalData,
} from '../../administration/mass-events/edit-modal/mass-event-edit-modal.component';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { FileRestriction, RESTRICTION_REASONS, AccessListEntry } from '../../../core/models/claim-overview.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

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

const TASKS_PAGE_SIZE = 10;

@Component({
  selector: 'app-claim-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NxIconModule,
    NxButtonModule,
    NxSpinnerModule,
    NxTableModule,
    NxPaginationModule,
    NxTooltipModule,
    NxPopoverModule,
    NxLinkModule,
    NxMessageModule,
    NxModalModule,
    NxSwitcherModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    ReactiveFormsModule,
    StatusChipComponent,
    ClaimPreviewDirective,
    ConfirmDialogComponent,
  ],
  templateUrl: './claim-overview.component.html',
  styleUrl: './claim-overview.component.scss',
})
export class ClaimOverviewComponent implements OnInit, OnDestroy, OverviewStage {
  readonly page = 'overview' as const;
  claimId: string | undefined;

  private readonly route          = inject(ActivatedRoute);
  private readonly overviewSvc    = inject(MockClaimOverviewService);
  private readonly taskSvc        = inject(MockTaskService);
  private readonly closureSvc     = inject(ClaimClosureService);
  private readonly stateSvc       = inject(MockStateService);
  private readonly stageSvc       = inject(ScenarioStageService);
  private readonly dialogSvc      = inject(NxDialogService);
  private readonly massEventSvc   = inject(MockMassEventService);
  private readonly destroyRef     = inject(DestroyRef);
  private readonly toast          = inject(ToastService);
  private readonly userDir        = inject(MockUserDirectoryService);
  private readonly sectionSvc    = inject(MockSectionService);
  private deregisterStage: (() => void) | null = null;

  readonly vm$ = new BehaviorSubject<OverviewVM>(EMPTY_VM);
  readonly tasksPageSize = TASKS_PAGE_SIZE;
  tasksPage = 1;

  readonly closureCheck = signal<BlockerCheckResult | null>(null);
  readonly closedSectionsCount = signal<number>(0);

  private readonly state$ = toObservable(this.stateSvc.state);

  ngOnInit(): void {
    this.deregisterStage = this.stageSvc.register(this);
    this.setupCoUserSearch();

    combineLatest([
      this.route.paramMap,
      this.state$,
    ]).pipe(
      switchMap(([params]) => {
        const claimId = params.get('id') ?? 'CL-2025-001';
        this.claimId = claimId;
        this.vm$.next(EMPTY_VM);
        return combineLatest({
          overview: this.overviewSvc.getOverviewWithActivities(claimId),
          tasks:    this.taskSvc.getByClaimId(claimId),
          closure:  this.closureSvc.validateBlockers(claimId),
        }).pipe(
          switchMap(({ overview, tasks, closure }) => {
            const massEventId = overview.claim?.massEventId;
            return combineLatest({
              massEvent: massEventId ? this.massEventSvc.getById(massEventId) : of(null),
            }).pipe(map(({ massEvent }) => ({ overview, tasks, closure, massEvent })));
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ overview, tasks, closure, massEvent }) => {
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
          this.initRestrictionForm(overview.claim);
          this.refreshClosedSectionsCount(overview.claim.claimId);
        }
      },
      error: () =>
        this.vm$.next({ ...EMPTY_VM, loading: false, error: 'Failed to load claim overview.', massEvent: null }),
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

  async openRecoveryPotentialModal(claim: ClaimOverview): Promise<void> {
    const current = claim.recoveryPotential ?? null;
    const next: 'yes' | 'no' = current === 'yes' ? 'no' : 'yes';
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: next === 'yes' ? 'Set recovery potential' : 'Update recovery potential',
        message: next === 'yes'
          ? 'Mark this claim as having recovery potential? A task will be created for recovery analysis.'
          : 'Change recovery potential to No? Please add a note to explain why recovery is no longer expected.',
        confirmLabel: next === 'yes' ? 'Set to Yes' : 'Set to No',
      } satisfies ConfirmDialogData,
      width: '400px',
      maxWidth: '92vw',
    });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    const cur = this.vm$.value;
    if (!cur.claim) return;
    this.vm$.next({ ...cur, claim: { ...cur.claim, recoveryPotential: next } });
    if (next === 'yes') {
      this.toast.success('Recovery potential set to Yes', 'A task has been created for recovery analysis.');
    } else {
      this.toast.success('Recovery potential updated to No');
    }
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
    this.toast.success('Claim reopened', subtitle);
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

  riskClass(score: number): string {
    if (score >= 4) return 'risk-high';
    if (score >= 3) return 'risk-medium';
    return 'risk-low';
  }

  priorityDotClass(priority: string): string {
    return `dot--${priority}`;
  }

  pendingTasks(tasks: Task[]): Task[] {
    return tasks.filter(t => t.status !== 'done');
  }

  taskCountByPriority(tasks: Task[], priority: string): number {
    return this.pendingTasks(tasks).filter(t => t.priority === priority).length;
  }

  formatAmount(amount: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
  }

  pagedTasks(tasks: Task[]): Task[] {
    const start = (this.tasksPage - 1) * TASKS_PAGE_SIZE;
    return tasks.slice(start, start + TASKS_PAGE_SIZE);
  }

  openMassEventDetail(): void {
    const me = this.vm$.value.massEvent;
    if (!me) return;
    const data: MassEventModalData = { mode: 'view', event: me };
    // Use the same bottom-sheet panel as the admin Mass Events page so the
    // modal has a proper height constraint + scroll (the component's SCSS
    // assumes the .me-edit-modal-panel wrapper).
    this.dialogSvc.open(MassEventEditModalComponent, { data, panelClass: 'me-edit-modal-panel' });
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }

  // ── File restriction (BMPCC-10994) ─────────────────────────────────

  readonly restrictionReasons = [...RESTRICTION_REASONS];

  readonly restrictionForm = new FormGroup({
    isRestricted: new FormControl(false),
    reason:       new FormControl<string>(''),
    otherReason:  new FormControl(''),
  });

  get isRestricted(): boolean { return !!this.restrictionForm.get('isRestricted')?.value; }
  get selectedReason(): string { return this.restrictionForm.get('reason')?.value ?? ''; }
  get isOtherReason(): boolean { return this.selectedReason === 'Other'; }
  get restrictionToggle(): FormControl { return this.restrictionForm.get('isRestricted') as FormControl; }

  readonly coAccessList = signal<AccessListEntry[]>([]);
  readonly coUserSearchControl = new FormControl('');
  readonly coUserSearchResults = signal<UserDirectoryEntry[]>([]);

  private initRestrictionForm(claim: ClaimOverview): void {
    const r = claim.restriction;
    this.restrictionForm.patchValue({
      isRestricted: r?.isRestricted ?? false,
      reason: r?.reason ?? '',
    });
    this.coAccessList.set(r?.accessList ?? []);
  }

  onToggleRestriction(checked: boolean): void {
    this.restrictionForm.get('isRestricted')!.setValue(checked);
    if (!checked) {
      this.restrictionForm.get('reason')!.setValue('');
      this.coAccessList.set([]);
    }
    this.saveRestrictionToClaim();
  }

  saveRestrictionToClaim(): void {
    const cur = this.vm$.value;
    if (!cur.claim) return;
    const isRestricted = this.isRestricted;
    const restriction: FileRestriction = {
      isRestricted,
      reason: isRestricted ? (this.isOtherReason ? (this.restrictionForm.get('otherReason')?.value ?? '') : this.selectedReason) : undefined,
      accessList: isRestricted ? this.coAccessList() : [],
    };
    this.vm$.next({ ...cur, claim: { ...cur.claim, restriction } });
  }

  addCoUser(user: UserDirectoryEntry): void {
    const entry: AccessListEntry = {
      userId:  user.userId,
      name:    user.name,
      role:    user.role,
      email:   user.email,
      addedAt: new Date().toISOString().split('T')[0],
    };
    this.coAccessList.update(list => [...list, entry]);
    this.coUserSearchControl.setValue('');
    this.coUserSearchResults.set([]);
    this.saveRestrictionToClaim();
  }

  removeCoUser(userId: string): void {
    this.coAccessList.update(list => list.filter(e => e.userId !== userId));
    this.saveRestrictionToClaim();
  }

  private setupCoUserSearch(): void {
    this.coUserSearchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => q && q.length >= 2 ? this.userDir.search(q) : of([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      const addedIds = new Set(this.coAccessList().map(e => e.userId));
      this.coUserSearchResults.set(results.filter(u => !addedIds.has(u.userId)));
    });
  }
}
