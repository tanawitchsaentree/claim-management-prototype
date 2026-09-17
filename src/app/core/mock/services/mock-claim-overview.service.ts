import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { Claim } from '../../models/claim.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockClaimService } from './mock-claim.service';
import { MockTaskService } from './mock-task.service';
import { MockLookupService } from './mock-lookup.service';

interface LinkablePolicy {
  policyNumber: string;
  lineOfBusiness: string;
  broker?: string;
}

@Injectable({ providedIn: 'root' })
export class MockClaimOverviewService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly claimSvc = inject(MockClaimService);
  private readonly taskSvc = inject(MockTaskService);
  private readonly lookupSvc = inject(MockLookupService);

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
    // No fallback to a hardcoded demo claim on failure — showing an unrelated
    // client's data for a claimId that genuinely doesn't exist is worse than
    // surfacing "not found."
    return this.claimSvc.getById(claimId).pipe(
      map(claim => this.synthesizeOverviewFromClaim(claim)),
      switchMap(overview => this.persistAndRespond(claimId, overview))
    );
  }

  private persistAndRespond(claimId: string, overview: ClaimOverview): Observable<ClaimOverview> {
    this.stateSvc.ensureOverview(claimId, overview);
    return this.respond(overview);
  }

  // Claim.causeOfLoss stores lookup codes (e.g. "fire"); every other read
  // path (edit-loss-information's syncOverviewFromLossInfo) converts to the
  // display label before writing proximateLossCause/causeOfLoss on the
  // overview — do the same here, or a claim whose overview is synthesized
  // fresh (never hand-edited) shows the raw code instead of "Fire".
  private causeLabels(codes: string[] | undefined): string[] {
    if (!codes?.length) return [];
    const opts = this.lookupSvc.getCauseOfLossSync();
    return codes.map(code => opts.find(o => o.value === code)?.label ?? code);
  }

  private synthesizeOverviewFromClaim(claim: Claim): ClaimOverview {
    const causeOfLoss = this.causeLabels(claim.causeOfLoss);
    return {
      claimId: claim.claimId,
      client: claim.clientName,
      assignedHandler: claim.assignee ?? 'Unassigned',
      // Orphan-claim statuses pass through as-is — collapsing them to 'Open'
      // hid that a claim has no linked policy yet (showed a "Close Claim"
      // button on a claim that was never opened against a policy).
      status:
        claim.status === 'Closed' ||
        claim.status === 'Awaiting policy' ||
        claim.status === 'Matched' ||
        claim.status === 'Abandoned'
          ? claim.status
          : 'Open',
      proximateLossCause: causeOfLoss[0] ?? '–',
      causeOfLoss: causeOfLoss.length ? causeOfLoss : undefined,
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
      location: {
        street: '',
        city: claim.location?.city ?? '',
        country: claim.location?.country ?? ''
      },
      financialSummary: {
        currency: claim.currency,
        totalReserve: claim.lossAmount,
        totalPayments: 0,
        totalRecoveries: 0,
        outstanding: claim.lossAmount
      },
      massEventId: claim.massEventId,
      massEventLinkStatus: claim.massEventLinkStatus,
      massEventLinkedBy: claim.massEventLinkedBy,
      massEventOverriddenBy: claim.massEventOverriddenBy,
      claimType: claim.claimType
    };
  }

  // "Convert to claim": links the policy onto the Claim, then re-synthesizes
  // and patches any ALREADY-CACHED overview for it. getOverview() caches on
  // first read (persistAndRespond -> ensureOverview, which only inserts if
  // missing) — without this, a claim viewed once before converting would
  // keep showing its pre-conversion snapshot (no policy, "Awaiting policy")
  // forever, since ensureOverview never overwrites an existing entry.
  async convertToRegularClaim(claimId: string, policy: LinkablePolicy): Promise<Claim> {
    const before = await firstValueFrom(this.claimSvc.getById(claimId));
    const claim = await firstValueFrom(this.claimSvc.linkPolicy(claimId, policy));
    this.stateSvc.patchOverview(claimId, this.synthesizeOverviewFromClaim(claim));
    this.appendActivities(claimId, [
      {
        id: `act-${Date.now()}`,
        claimId,
        user: claim.assignee ?? 'Unassigned',
        timestamp: new Date().toISOString(),
        objectType: 'Claim',
        attribute: 'Policy',
        valueOld: before.status,
        valueNew: `${policy.policyNumber} — status changed to Open`
      }
    ]);
    // A converted orphan claim needs its structure set up (sections, reserves)
    // just like any other claim — but nothing surfaces that anywhere a handler
    // actually works from (Dashboard task list, Task manager). Without this,
    // the only place it was visible was the Overview banner/Close-Claim
    // blocker, both of which only trigger if the handler happens to open this
    // specific claim again. A real task puts it in the same queue as every
    // other piece of work, and carries forward the urgency the skeleton had
    // pre-conversion (3-day SLA) instead of it evaporating at conversion.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    await firstValueFrom(
      this.taskSvc.create({
        claimId,
        taskType: 'Review',
        description: `Set up sections and reserves for ${claimId} (converted from orphan claim)`,
        status: 'open',
        dueDate: dueDate.toISOString().split('T')[0],
        priority: 'high',
        assignee: claim.assignee ?? 'Unassigned'
      })
    );
    return claim;
  }

  hasOverview(claimId: string): boolean {
    return claimId in this.stateSvc.state().overviews;
  }

  getActivities(claimId: string): Observable<ClaimActivity[]> {
    const activities = this.stateSvc.state().activities;
    return this.list(activities.filter(a => a.claimId === claimId));
  }

  appendActivities(claimId: string, entries: ClaimActivity[]): void {
    this.stateSvc.patchActivities(existing => [...entries, ...existing]);
  }

  updateGeneralInfo(claimId: string, patch: Partial<ClaimOverview>): Observable<ClaimOverview> {
    this.stateSvc.patchOverview(claimId, patch);
    return this.getOverview(claimId);
  }

  getOverviewWithActivities(
    claimId: string
  ): Observable<{ claim: ClaimOverview; activities: ClaimActivity[] }> {
    return combineLatest({
      claim: this.getOverview(claimId),
      activities: this.getActivities(claimId)
    });
  }
}
