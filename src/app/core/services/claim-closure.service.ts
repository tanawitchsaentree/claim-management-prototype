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
            this.buildBlockerResult(tasks, openSections)
          ),
          delay(MOCK_DELAY_MS),
        );
      }),
    );
  }

  private buildBlockerResult(tasks: Task[], openSections: number): BlockerCheckResult {
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

    // Checks 3-9: stubbed — integrate real data in future phases
    const stubs: Array<{ type: Blocker['type']; label: string }> = [
      { type: 'payments',   label: 'Outstanding payments must be settled' },
      { type: 'reserves',   label: 'Open reserves must be closed or released' },
      { type: 'recovery',   label: 'Active recovery actions must be resolved' },
      { type: 'deductible', label: 'Deductible collections must be confirmed' },
      { type: 'litigation', label: 'Open litigation must be resolved' },
      { type: 'provider',   label: 'Provider instructions must be finalised' },
      { type: 'bills',      label: 'Unpaid bills must be cleared' },
      { type: 'reports',    label: 'Required reports must be submitted' },
    ];
    void stubs;

    return { canClose: blockers.length === 0, blockers };
  }

  closeClaim(claimId: string, payload: ClosurePayload): Observable<ClaimOverview> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (claim.status === 'Closed') {
          return throwError(() => new Error(`Claim ${claimId} is already closed.`));
        }

        const now = new Date().toISOString().split('T')[0];
        const closed: ClaimOverview = {
          ...claim,
          status: 'Closed',
          closureDate: now,
          closedBy: payload.confirmedBy,
          closureReason: payload.reason,
          retentionType: payload.retentionType,
          retentionDate: payload.retentionDate ?? this.defaultRetentionDate(now),
        };

        return of(closed).pipe(
          delay(MOCK_DELAY_MS),
          tap(result => this.mockState.patchOverview(claimId, result)),
        );
      }),
    );
  }

  // Phase 4 implementation
  reopenClaim(_claimId: string, _payload: ReopenPayload): Observable<ClaimOverview> {
    return throwError(() => new Error('reopenClaim: Not implemented in Phase 2'));
  }

  private defaultRetentionDate(fromDate: string): string {
    const d = new Date(fromDate);
    d.setFullYear(d.getFullYear() + 10);
    return d.toISOString().split('T')[0];
  }
}
