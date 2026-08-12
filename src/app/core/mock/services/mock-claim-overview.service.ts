import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { SkeletonClaim } from '../../models/skeleton-claim.model';
import { Claim } from '../../models/claim.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockSkeletonClaimService } from './mock-skeleton-claim.service';
import { MockClaimService } from './mock-claim.service';

@Injectable({ providedIn: 'root' })
export class MockClaimOverviewService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly skeletonSvc = inject(MockSkeletonClaimService);
  private readonly claimSvc = inject(MockClaimService);

  getOverview(claimId: string): Observable<ClaimOverview> {
    const existing = this.stateSvc.state().overviews[claimId];
    if (existing) return this.respond(existing);

    // Not a regular claim yet — check whether it's a skeleton (orphan) claim
    // opened via Search before it's matched to a policy. Without this, any
    // claimId absent from claim-overview.json silently falls back to the
    // unrelated default claim below, so viewing/editing a skeleton claim
    // would show and "save" someone else's data.
    return this.skeletonSvc.getById(claimId).pipe(
      map(skeleton => this.synthesizeOverviewFromSkeleton(skeleton)),
      switchMap(overview => this.persistAndRespond(claimId, overview)),
      catchError(() => this.fromClaimOrFallback(claimId)),
    );
  }

  // claims.json (the main Claims list) seeds far more claimIds than
  // claim-overview.json has dedicated records for — most claims in that list
  // have never had a hand-authored overview. Synthesize one from the Claim
  // record rather than falling through to the CL-2025-001 default, or every
  // claim clicked from the list would silently show/edit unrelated data.
  private fromClaimOrFallback(claimId: string): Observable<ClaimOverview> {
    return this.claimSvc.getById(claimId).pipe(
      map(claim => this.synthesizeOverviewFromClaim(claim)),
      switchMap(overview => this.persistAndRespond(claimId, overview)),
      catchError(() => {
        // Fallback to CL-2025-001 only for the primary routed view (legacy behaviour).
        const fallback = this.stateSvc.state().overviews['CL-2025-001'];
        return this.respond(fallback);
      }),
    );
  }

  private persistAndRespond(claimId: string, overview: ClaimOverview): Observable<ClaimOverview> {
    this.stateSvc.ensureOverview(claimId, overview);
    return this.respond(overview);
  }

  private synthesizeOverviewFromSkeleton(skeleton: SkeletonClaim): ClaimOverview {
    const now = new Date().toISOString().split('T')[0];
    return {
      claimId: skeleton.claimId,
      client: skeleton.clientName,
      assignedHandler: skeleton.assignee ?? 'Unassigned',
      status: 'Open',
      proximateLossCause: '–',
      riskScore: 0,
      riskScoreMax: 5,
      riskStatus: 'Not assessed',
      policyNumber: skeleton.policyId ?? '',
      policyHolder: skeleton.clientName,
      handler: skeleton.assignee ?? 'Unassigned',
      supervisor: '',
      priority: 'medium',
      lineOfBusiness: '',
      dateOfLoss: skeleton.lossDate ?? now,
      dateCreated: skeleton.createdDate,
      description: skeleton.lossDescription,
      location: { street: '', city: '', country: '' },
      financialSummary: { currency: 'EUR', totalReserve: 0, totalPayments: 0, totalRecoveries: 0, outstanding: 0 },
    };
  }

  private synthesizeOverviewFromClaim(claim: Claim): ClaimOverview {
    return {
      claimId: claim.claimId,
      client: claim.clientName,
      assignedHandler: claim.assignee ?? 'Unassigned',
      status: claim.status === 'Closed' ? 'Closed' : 'Open',
      proximateLossCause: claim.causeOfLoss?.[0] ?? '–',
      riskScore: 0,
      riskScoreMax: 5,
      riskStatus: 'Not assessed',
      policyNumber: claim.policyNumber,
      policyHolder: claim.clientName,
      broker: claim.broker ?? undefined,
      handler: claim.assignee ?? 'Unassigned',
      supervisor: '',
      priority: claim.priority,
      lineOfBusiness: claim.lineOfBusiness,
      dateOfLoss: claim.lossDate,
      dateCreated: claim.dateCreated,
      description: claim.description,
      location: { street: '', city: claim.location?.city ?? '', country: claim.location?.country ?? '' },
      financialSummary: {
        currency: claim.currency,
        totalReserve: claim.lossAmount,
        totalPayments: 0,
        totalRecoveries: 0,
        outstanding: claim.lossAmount,
      },
      massEventId: claim.massEventId,
      massEventLinkStatus: claim.massEventLinkStatus,
      massEventLinkedBy: claim.massEventLinkedBy,
      massEventOverriddenBy: claim.massEventOverriddenBy,
    };
  }

  hasOverview(claimId: string): boolean {
    return claimId in this.stateSvc.state().overviews;
  }

  getActivities(claimId: string): Observable<ClaimActivity[]> {
    const activities = this.stateSvc.state().activities;
    // Fallback to the demo default's activity log only for that same legacy
    // default claim — any other unmatched claimId (e.g. a freshly-opened
    // skeleton claim) has a genuinely empty activity history.
    const filtered = activities.filter(a => a.claimId === claimId);
    if (filtered.length) return this.list(filtered);
    return this.list(claimId === 'CL-2025-001' ? activities : []);
  }

  appendActivities(claimId: string, entries: ClaimActivity[]): void {
    this.stateSvc.patchActivities(existing => [...entries, ...existing]);
  }

  updateGeneralInfo(claimId: string, patch: Partial<ClaimOverview>): Observable<ClaimOverview> {
    this.stateSvc.patchOverview(claimId, patch);
    return this.getOverview(claimId);
  }

  getOverviewWithActivities(claimId: string): Observable<{ claim: ClaimOverview; activities: ClaimActivity[] }> {
    return combineLatest({
      claim: this.getOverview(claimId),
      activities: this.getActivities(claimId),
    });
  }
}
