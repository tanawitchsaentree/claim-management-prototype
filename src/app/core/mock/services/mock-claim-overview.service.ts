import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { Claim } from '../../models/claim.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockClaimService } from './mock-claim.service';

interface LinkablePolicy {
  policyNumber: string;
  lineOfBusiness: string;
  broker?: string;
}

@Injectable({ providedIn: 'root' })
export class MockClaimOverviewService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly claimSvc = inject(MockClaimService);

  getOverview(claimId: string): Observable<ClaimOverview> {
    const existing = this.stateSvc.state().overviews[claimId];
    if (existing) return this.respond(existing);
    return this.fromClaimOrFallback(claimId);
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

  private synthesizeOverviewFromClaim(claim: Claim): ClaimOverview {
    return {
      claimId: claim.claimId,
      client: claim.clientName,
      assignedHandler: claim.assignee ?? 'Unassigned',
      // Orphan-claim statuses pass through as-is — collapsing them to 'Open'
      // hid that a claim has no linked policy yet (showed a "Close Claim"
      // button on a claim that was never opened against a policy).
      status: (claim.status === 'Closed' || claim.status === 'Awaiting policy'
        || claim.status === 'Matched' || claim.status === 'Abandoned')
        ? claim.status
        : 'Open',
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
      claimType: claim.claimType,
    };
  }

  // "Convert to claim": links the policy onto the Claim, then re-synthesizes
  // and patches any ALREADY-CACHED overview for it. getOverview() caches on
  // first read (persistAndRespond -> ensureOverview, which only inserts if
  // missing) — without this, a claim viewed once before converting would
  // keep showing its pre-conversion snapshot (no policy, "Awaiting policy")
  // forever, since ensureOverview never overwrites an existing entry.
  async convertToRegularClaim(claimId: string, policy: LinkablePolicy): Promise<Claim> {
    const claim = await firstValueFrom(this.claimSvc.linkPolicy(claimId, policy));
    this.stateSvc.patchOverview(claimId, this.synthesizeOverviewFromClaim(claim));
    return claim;
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
