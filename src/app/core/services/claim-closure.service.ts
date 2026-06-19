import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError, of, forkJoin, tap } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockTaskService } from '../mock/services/mock-task.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { MockLitigationService } from '../mock/services/mock-litigation.service';
import { MockReservesService } from '../mock/services/mock-reserves.service';
import { ClaimOverview, ClaimActivity } from '../models/claim-overview.model';
import { Task } from '../models/task.model';
import { Litigation } from '../models/litigation.model';
import { ReservesPolicyData } from '../models/reserve.model';
import {
  BlockerCheckResult,
  Blocker,
  ClosurePayload,
  ReopenPayload,
  validateClaimTransition,
  validateSectionTransition,
} from '../models/claim-closure.model';
import { ClaimSection } from '../models/section.model';
import { ToastService } from '../../shared/components/toast/toast.service';

const MOCK_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class ClaimClosureService {
  private readonly taskSvc       = inject(MockTaskService);
  private readonly overviewSvc   = inject(MockClaimOverviewService);
  private readonly sectionSvc    = inject(MockSectionService);
  private readonly mockState     = inject(MockStateService);
  private readonly litigationSvc = inject(MockLitigationService);
  private readonly reservesSvc   = inject(MockReservesService);
  private readonly toast         = inject(ToastService);

  validateSectionBlockers(section: ClaimSection): BlockerCheckResult {
    const blockers: Blocker[] = [];
    if (section.hasOpenDeductible)   blockers.push({ type: 'deductible', label: 'Open Manage Deductible task must be closed' });
    if (section.hasActiveLitigation) blockers.push({ type: 'litigation', label: 'Active litigation assignment must be resolved' });
    if (section.hasSubrogation)      blockers.push({ type: 'recovery',   label: 'Pending subrogation activity must be resolved' });
    if (section.hasActiveSalvage)    blockers.push({ type: 'recovery',   label: 'Pending salvage activity must be resolved' });
    if (section.hasOpenReserves)     blockers.push({ type: 'reserves',   label: 'Pending reserves must be released' });
    if (section.hasOpenPayments)     blockers.push({ type: 'payments',   label: 'Pending payments must be settled' });
    if (section.hasActiveProvider)   blockers.push({ type: 'provider',   label: 'Active provider assignment must be finalised' });
    return { canClose: blockers.length === 0, blockers };
  }

  validateBlockers(claimId: string): Observable<BlockerCheckResult> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (claim.status === 'Closed') {
          return of({ canClose: true, blockers: [] } as BlockerCheckResult).pipe(delay(MOCK_DELAY_MS));
        }
        return forkJoin({
          tasks:        this.taskSvc.getByClaimId(claimId),
          openSections: this.sectionSvc.getOpenSectionsCount(claimId),
          activeLit:    this.litigationSvc.search({ claimId, status: 'In progress' }),
          reservesData: claim.policyNumber
            ? this.reservesSvc.getReservesForPolicy(claim.policyNumber)
            : of(null),
        }).pipe(
          map(({ tasks, openSections, activeLit, reservesData }) =>
            this.buildBlockerResult(claim, tasks, openSections, activeLit, reservesData)
          ),
          delay(MOCK_DELAY_MS),
        );
      }),
    );
  }

  private buildBlockerResult(
    claim: ClaimOverview,
    tasks: Task[],
    openSections: number,
    activeLit: Litigation[],
    reservesData: ReservesPolicyData | null,
  ): BlockerCheckResult {
    const blockers: Blocker[] = [];

    const pending = tasks.filter(t => t.status !== 'done');
    if (pending.length > 0) {
      blockers.push({
        type: 'tasks',
        label: `${pending.length} pending task(s) must be resolved before closure`,
        count: pending.length,
      });
    }

    if (openSections > 0) {
      blockers.push({
        type: 'sections',
        label: `${openSections} open section(s) must be closed before claim closure`,
        count: openSections,
      });
    }

    // BMPCC-14435 — Litigation: deep check via MockLitigationService.
    // Falls back to boolean flag only if no policyNumber/claimId lookup was possible.
    if (activeLit.length > 0) {
      blockers.push({
        type:  'litigation',
        label: `${activeLit.length} active litigation case(s) must be resolved`,
        count: activeLit.length,
      });
    } else if (claim.hasActiveLitigation) {
      blockers.push({ type: 'litigation', label: 'Open litigation must be resolved' });
    }

    // BMPCC-14435 — Reserves: deep check via MockReservesService.
    // Falls back to boolean flag if policy data unavailable.
    const openReserves = reservesData?.reserves.filter(r => (r.amount ?? 0) > 0) ?? [];
    if (openReserves.length > 0) {
      const total = openReserves.reduce((sum, r) => sum + (r.amount ?? 0), 0);
      blockers.push({
        type:   'reserves',
        label:  `${openReserves.length} open reserve line(s) must be released`,
        count:  openReserves.length,
        amount: total,
      });
    } else if (claim.hasOpenReserves) {
      blockers.push({ type: 'reserves', label: 'Open reserves must be closed or released' });
    }

    // BMPCC-11360 AC2 — flag-only blockers (no domain service yet).
    if (claim.hasOpenPayments) {
      blockers.push({ type: 'payments',   label: 'Outstanding payments must be settled' });
    }
    if (claim.hasActiveRecovery) {
      blockers.push({ type: 'recovery',   label: 'Active recovery actions must be resolved' });
    }
    if (claim.hasOpenDeductible) {
      blockers.push({ type: 'deductible', label: 'Deductible collections must be confirmed' });
    }
    if (claim.hasActiveProvider) {
      blockers.push({ type: 'provider',   label: 'Provider instructions must be finalised' });
    }
    if (claim.hasUnpaidBills) {
      blockers.push({ type: 'bills',      label: 'Unpaid bills must be cleared' });
    }
    if (claim.hasIncompleteReports) {
      blockers.push({ type: 'reports',    label: 'Required reports must be submitted' });
    }

    return { canClose: blockers.length === 0, blockers };
  }

  closeClaim(claimId: string, payload: ClosurePayload): Observable<ClaimOverview> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (!validateClaimTransition(claim.status as import('../models/claim.model').ClaimStatus, 'Closed')) {
          const msg = `Invalid transition: ${claim.status} → Closed for claim ${claimId}.`;
          console.error('[claim-closure]', msg);
          return throwError(() => new Error(msg));
        }

        const now = new Date().toISOString().split('T')[0];
        const retentionDate = payload.retentionType === 'indefinite'
          ? undefined
          : (payload.retentionDate ?? this.defaultRetentionDate(now));

        const closed: ClaimOverview = {
          ...claim,
          status: 'Closed',
          closureDate: now,
          closedBy: payload.confirmedBy,
          closureReason: payload.reason,
          retentionType: payload.retentionType,
          retentionDate,
        };

        return of(closed).pipe(
          delay(MOCK_DELAY_MS),
          tap(result => {
            this.mockState.patchOverview(claimId, result);
            // BMPCC-11360 AC4 — loss event auto-closes when all linked claims are closed.
            this.maybeCloseLossEvent(result.lossEventId);
          }),
        );
      }),
    );
  }

  /**
   * Auto-close the loss event if every claim sharing the same lossEventId is now Closed.
   * BMPCC-14434 GAP-1: writes status to LossEventSummary state and fires a toast.
   * Kafka publish hook is reserved for a future backend integration step.
   */
  private maybeCloseLossEvent(lossEventId: string | null | undefined): void {
    if (!lossEventId) return;
    const state = this.mockState.state();
    const linked = Object.values(state.overviews).filter(c => c.lossEventId === lossEventId);
    if (linked.length === 0) return;
    if (!linked.every(c => c.status === 'Closed')) return;

    // Guard: only close if not already closed in state.
    const existing = state.lossEvents.find(e => e.lossEventId === lossEventId);
    if (existing?.status === 'Closed') return;

    this.mockState.patchLossEvent(lossEventId, { status: 'Closed' });

    const activity: ClaimActivity = {
      id:         `act-le-close-${Date.now()}`,
      claimId:    linked[0].claimId,
      user:       'System',
      timestamp:  new Date().toISOString(),
      objectType: 'Loss Event',
      attribute:  'Status',
      valueOld:   existing?.status ?? 'Open',
      valueNew:   'Closed',
    };
    this.mockState.patchActivities(items => [activity, ...items]);

    this.toast.success(
      `Loss Event ${lossEventId} auto-closed`,
      'All linked claims are resolved.',
    );
  }

  reopenClaim(claimId: string, payload: ReopenPayload): Observable<ClaimOverview> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (!validateClaimTransition(claim.status as import('../models/claim.model').ClaimStatus, 'Reopened')) {
          const msg = `Invalid transition: ${claim.status} → Reopened for claim ${claimId}.`;
          console.error('[claim-closure]', msg);
          return throwError(() => new Error(msg));
        }
        const now = new Date().toISOString().split('T')[0];
        const reopened: ClaimOverview = {
          ...claim,
          status: 'Reopened',
          reopenedDate: now,
          reopeningReason: payload.reason,
        };
        return of(reopened).pipe(
          delay(MOCK_DELAY_MS),
          tap(result => this.mockState.patchOverview(claimId, result)),
        );
      }),
    );
  }

  private defaultRetentionDate(fromDate: string): string {
    const d = new Date(fromDate);
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().split('T')[0];
  }
}
