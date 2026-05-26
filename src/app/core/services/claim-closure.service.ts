import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError, of, forkJoin, tap } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockTaskService } from '../mock/services/mock-task.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { ClaimOverview } from '../models/claim-overview.model';
import { Task } from '../models/task.model';
import {
  BlockerCheckResult,
  Blocker,
  ClosurePayload,
  ReopenPayload,
} from '../models/claim-closure.model';

const MOCK_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class ClaimClosureService {
  private readonly taskSvc     = inject(MockTaskService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly mockState   = inject(MockStateService);

  validateBlockers(claimId: string): Observable<BlockerCheckResult> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (claim.status === 'Closed') {
          return of({ canClose: true, blockers: [] } as BlockerCheckResult).pipe(delay(MOCK_DELAY_MS));
        }
        return forkJoin({
          tasks:        this.taskSvc.getByClaimId(claimId),
          openSections: this.sectionSvc.getOpenSectionsCount(claimId),
        }).pipe(
          map(({ tasks, openSections }) =>
            this.buildBlockerResult(claim, tasks, openSections)
          ),
          delay(MOCK_DELAY_MS),
        );
      }),
    );
  }

  private buildBlockerResult(claim: ClaimOverview, tasks: Task[], openSections: number): BlockerCheckResult {
    const blockers: Blocker[] = [];

    const pending = tasks.filter(t => t.status !== 'done');
    if (pending.length > 0) {
      blockers.push({
        type: 'tasks',
        label: 'pending task(s) must be resolved before closure',
        count: pending.length,
      });
    }

    if (openSections > 0) {
      blockers.push({
        type: 'sections',
        label: 'open section(s) must be closed before claim closure',
        count: openSections,
      });
    }

    // BMPCC-11360 AC2 — additional blocker flags read from claim overview.
    if (claim.hasOpenPayments) {
      blockers.push({ type: 'payments',   label: 'Outstanding payments must be settled' });
    }
    if (claim.hasOpenReserves) {
      blockers.push({ type: 'reserves',   label: 'Open reserves must be closed or released' });
    }
    if (claim.hasActiveRecovery) {
      blockers.push({ type: 'recovery',   label: 'Active recovery actions must be resolved' });
    }
    if (claim.hasOpenDeductible) {
      blockers.push({ type: 'deductible', label: 'Deductible collections must be confirmed' });
    }
    if (claim.hasActiveLitigation) {
      blockers.push({ type: 'litigation', label: 'Open litigation must be resolved' });
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
        if (claim.status === 'Closed') {
          return throwError(() => new Error(`Claim ${claimId} is already closed.`));
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
   * Reads from MockStateService.state().overviews so it sees current sessionStorage state.
   */
  private maybeCloseLossEvent(lossEventId: string | null | undefined): void {
    if (!lossEventId) return;
    const all = Object.values(this.mockState.state().overviews);
    const linked = all.filter(c => c.lossEventId === lossEventId);
    if (linked.length === 0) return;
    const allClosed = linked.every(c => c.status === 'Closed');
    if (!allClosed) return;
    // Loss event itself isn't an entity in the overview shape — annotate via tap log.
    // (Hook reserved for future Kafka publish step described in BMPCC-11360.)
    console.info('[claim-closure] Loss event auto-closed:', lossEventId);
  }

  reopenClaim(claimId: string, payload: ReopenPayload): Observable<ClaimOverview> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (claim.status !== 'Closed') {
          return throwError(() => new Error(`Claim ${claimId} is not closed.`));
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
