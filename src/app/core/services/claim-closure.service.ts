import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap, throwError, of, forkJoin, tap } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockTaskService } from '../mock/services/mock-task.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { MockLitigationService } from '../mock/services/mock-litigation.service';
import { MockReservesService } from '../mock/services/mock-reserves.service';
import { MockPaymentsService } from '../mock/services/mock-payments.service';
import { MockProviderService } from '../mock/services/mock-provider.service';
import { ClaimOverview, ClaimActivity } from '../models/claim-overview.model';
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
import { buildBlockerResult } from './claim-closure-blocker.builder';
import { MOCK_BLOCKER_ITEMS } from '../mock/data/blocker-items.mock';

const MOCK_DELAY_MS = 300;

@Injectable({ providedIn: 'root' })
export class ClaimClosureService {
  private readonly taskSvc       = inject(MockTaskService);
  private readonly overviewSvc   = inject(MockClaimOverviewService);
  private readonly sectionSvc    = inject(MockSectionService);
  private readonly mockState     = inject(MockStateService);
  private readonly litigationSvc = inject(MockLitigationService);
  private readonly reservesSvc   = inject(MockReservesService);
  private readonly paymentsSvc   = inject(MockPaymentsService);
  private readonly providerSvc   = inject(MockProviderService);
  private readonly toast         = inject(ToastService);

  validateSectionBlockers(section: ClaimSection): BlockerCheckResult {
    const blockers: Blocker[] = [];
    if (section.hasOpenDeductible)   blockers.push({ type: 'deductible', label: 'Open Manage Deductible task must be closed',    items: MOCK_BLOCKER_ITEMS['deductible'] });
    if (section.hasActiveLitigation) blockers.push({ type: 'litigation', label: 'Active litigation assignment must be resolved', items: MOCK_BLOCKER_ITEMS['litigation'] });
    if (section.hasSubrogation)      blockers.push({ type: 'recovery',   label: 'Pending subrogation activity must be resolved', items: MOCK_BLOCKER_ITEMS['recovery'] });
    if (section.hasActiveSalvage)    blockers.push({ type: 'recovery',   label: 'Pending salvage activity must be resolved',     items: MOCK_BLOCKER_ITEMS['recovery'] });
    if (section.hasOpenReserves)     blockers.push({ type: 'reserves',   label: 'Pending reserves must be released',             items: MOCK_BLOCKER_ITEMS['reserves'] });
    if (section.hasOpenPayments)     blockers.push({ type: 'payments',   label: 'Pending payments must be settled',              items: MOCK_BLOCKER_ITEMS['payments'] });
    if (section.hasActiveProvider)   blockers.push({ type: 'provider',   label: 'Active provider assignment must be finalised',  items: MOCK_BLOCKER_ITEMS['provider'] });
    return { canClose: blockers.length === 0, blockers };
  }

  validateBlockers(claimId: string): Observable<BlockerCheckResult> {
    return this.overviewSvc.getOverview(claimId).pipe(
      switchMap(claim => {
        if (claim.status === 'Closed') {
          return of({ canClose: true, blockers: [] } as BlockerCheckResult).pipe(delay(MOCK_DELAY_MS));
        }
        return forkJoin({
          tasks:           this.taskSvc.getByClaimId(claimId),
          openSections:    this.sectionSvc.getOpenSectionsCount(claimId),
          activeLit:       this.litigationSvc.search({ claimId, status: 'In progress' }),
          reservesData:    claim.policyNumber
            ? this.reservesSvc.getReservesForPolicy(claim.policyNumber)
            : of(null),
          pendingPayments: this.paymentsSvc.getOpenPaymentsForClaim(claimId),
          activeProviders: this.providerSvc.getActiveAssignmentsForClaim(claimId),
        }).pipe(
          map(({ tasks, openSections, activeLit, reservesData, pendingPayments, activeProviders }) =>
            buildBlockerResult(claim, tasks, openSections, activeLit, reservesData, pendingPayments, activeProviders)
          ),
          delay(MOCK_DELAY_MS),
        );
      }),
    );
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

  autoCloseSection(
    claimId: string,
    sectionId: string,
    triggeredBy: 'finalPayment',
  ): Observable<ClaimSection> {
    const state = this.mockState.state();
    const section = state.sections.find(s => s.id === sectionId && s.claimId === claimId);
    if (!section) {
      return throwError(() => new Error(`Section ${sectionId} not found on claim ${claimId}`));
    }

    const blockers = this.validateSectionBlockers(section).blockers.filter(
      b => triggeredBy === 'finalPayment' ? b.type !== 'payments' : true,
    );
    if (blockers.length > 0) {
      const labels = blockers.map(b => b.label).join('; ');
      return throwError(() => new Error(`Cannot auto-close section ${sectionId}: ${labels}`));
    }

    const systemUser = { userId: 'system', name: 'System' };
    return this.sectionSvc.closeSection(sectionId, systemUser, 'Section Finalised').pipe(
      tap(closed => {
        this.toast.success(
          `Section ${closed.name} auto-closed — final payment received`,
        );
        this.maybeAutoCloseClaim(claimId);
      }),
    );
  }

  triggerFinalPaymentAndClose(claimId: string, sectionId: string): Observable<ClaimSection> {
    return this.paymentsSvc.triggerFinalPayment(claimId, sectionId).pipe(
      switchMap(() => this.autoCloseSection(claimId, sectionId, 'finalPayment')),
    );
  }

  private maybeAutoCloseClaim(claimId: string): void {
    const state = this.mockState.state();
    const sections = state.sections.filter(s => s.claimId === claimId);
    if (sections.length === 0) return;
    if (!sections.every(s => s.status === 'Closed')) return;

    const overview = state.overviews[claimId];
    if (!overview || overview.status === 'Closed') return;

    // Apply closure directly on mock state to avoid subscribing inside a service.
    // This mirrors the side-effects in closeClaim() without needing an Observable subscription.
    const systemUser = { userId: 'system', name: 'System' };
    const now = new Date().toISOString().split('T')[0];
    const retentionDate = this.defaultRetentionDate(now);
    const closed: ClaimOverview = {
      ...overview,
      status: 'Closed',
      closureDate: now,
      closedBy: systemUser,
      closureReason: 'Claim Finalised',
      retentionType: 'default',
      retentionDate,
    };
    this.mockState.patchOverview(claimId, closed);
    this.maybeCloseLossEvent(closed.lossEventId);
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
