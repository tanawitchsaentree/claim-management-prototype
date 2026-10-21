import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, firstValueFrom } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { causeLabel } from '../../models/cause-of-loss';
import { CompletionDetails } from '../../models/claim-completion.model';
import { LossInformationFormValue } from '../../models/loss-information.model';
import { MockLossInformationService } from './mock-loss-information.service';
import { Claim } from '../../models/claim.model';
import { MockBaseService } from './mock-base.service';
import { ClaimNumberService } from '../../services/claim-number.service';
import { MockStateService } from '../state/mock-state.service';
import { MockClaimService } from './mock-claim.service';
import { MockTaskService } from './mock-task.service';
import { MockLookupService } from './mock-lookup.service';
import { MockSectionService } from './mock-section.service';
import overviewSeed from '../data/claim-overview.json';

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
  private readonly sectionSvc = inject(MockSectionService);
  private readonly lossInfoSvc = inject(MockLossInformationService);
  private readonly numberSvc = inject(ClaimNumberService);

  getOverview(claimId: string): Observable<ClaimOverview> {
    const existing = this.stateSvc.state().overviews[claimId];
    if (existing) return this.respond(this.withLiveFinancials(existing));
    return this.fromClaimOrFallback(claimId);
  }

  // The claim panel's "Total reserve" / "Total payments" used to be the claim's
  // lossAmount and 0 for every claim that has no hand-written overview record,
  // while its Financial Overview page showed real rows. Read them from that same
  // page's summary so the two never disagree. Hand-written records in
  // claim-overview.json keep their own numbers (they were written to match).
  private withLiveFinancials(overview: ClaimOverview): ClaimOverview {
    if (overview.claimId in (overviewSeed as Record<string, unknown>)) return overview;
    const fo = this.stateSvc.state().financialOverviews[overview.claimId];
    if (!fo || !(fo.reserves.length || fo.payments.length || fo.recoveries.length)) return overview;
    return {
      ...overview,
      financialSummary: {
        ...overview.financialSummary,
        totalReserve: fo.summary.outstandingReserves,
        totalPayments: fo.summary.completedPayments,
        totalRecoveries: fo.summary.recoveries,
        outstanding: fo.summary.outstandingReserves
      }
    };
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
    return this.respond(this.withLiveFinancials(overview));
  }

  // Claim.causeOfLoss stores lookup codes (e.g. "fire"); every other read
  // path (edit-loss-information's syncOverviewFromLossInfo) converts to the
  // display label before writing proximateLossCause/causeOfLoss on the
  // overview — do the same here, or a claim whose overview is synthesized
  // fresh (never hand-edited) shows the raw code instead of "Fire".
  private causeLabels(codes: string[] | undefined): string[] {
    if (!codes?.length) return [];
    const opts = this.lookupSvc.getCauseOfLossSync();
    return codes.map(code => causeLabel(code, opts));
  }

  private synthesizeOverviewFromClaim(claim: Claim): ClaimOverview {
    const causeOfLoss = this.causeLabels(claim.causeOfLoss);
    return {
      claimId: claim.claimId,
      client: claim.clientName,
      assignedHandler: claim.assignee ?? 'Unassigned',
      // status is always a real ClaimStatus now (Open/Closed/...) — the
      // orphan-claim pre-policy stage lives in skeletonState below instead
      // of being squeezed into this field.
      status: claim.status,
      skeletonState: claim.skeletonState,
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
      claimType: claim.claimType,
      abandonReason: claim.abandonReason
    };
  }

  // "Convert to claim": links the policy onto the Claim, then re-synthesizes
  // and patches any ALREADY-CACHED overview for it. getOverview() caches on
  // first read (persistAndRespond -> ensureOverview, which only inserts if
  // missing) — without this, a claim viewed once before converting would
  // keep showing its pre-conversion snapshot (no policy, skeletonState
  // 'awaiting-policy') forever, since ensureOverview never overwrites an
  // existing entry.
  //
  // Returns locationNeedsReconfirm alongside the claim so both call sites'
  // success toast can say so accurately instead of only ever mentioning the
  // reserves task — the toast text used to be a flat string that silently
  // under-reported what actually landed in the handler's task queue.
  async convertToRegularClaim(
    claimId: string,
    policy: LinkablePolicy,
    details?: CompletionDetails
  ): Promise<{ claim: Claim; locationNeedsReconfirm: boolean; claimNumber: string; formerNumber: string }> {
    const linked = await firstValueFrom(this.claimSvc.linkPolicy(claimId, policy));
    // The "Complete the claim" step is written before the section is made, so the
    // section follows the confirmed cause (never an empty one).
    const claim = details ? await this.applyCompletion(linked, details) : linked;
    // It is a regular claim now: it gets a regular claim number. The internal id (and
    // so every record pointing at it) stays; the SK- number becomes a permanent alias.
    const { number: claimNumber, former: formerNumber } = this.numberSvc.assign(claimId);
    this.stateSvc.patchOverview(claimId, this.synthesizeOverviewFromClaim(claim));
    this.appendActivities(claimId, [
      {
        id: `act-num-${Date.now()}`,
        claimId,
        user: claim.assignee ?? 'Unassigned',
        timestamp: new Date().toISOString(),
        objectType: 'Claim',
        attribute: 'Claim number',
        valueOld: formerNumber,
        valueNew: claimNumber
      },
      {
        id: `act-${Date.now()}`,
        claimId,
        user: claim.assignee ?? 'Unassigned',
        timestamp: new Date().toISOString(),
        objectType: 'Claim',
        attribute: 'Policy',
        // status is 'Open' before and after (unchanged) — skeletonState is
        // what actually transitions on conversion.
        valueOld: 'Awaiting policy',
        valueNew: `${policy.policyNumber} — linked`
      }
    ]);
    // The skeleton-creation path (step-skeleton-summary.ts) already creates
    // this claim's section from its cause of loss at creation time — this
    // is only a fallback for claims that predate that fix (or somehow
    // reached conversion without ever getting one), guarded so conversion
    // never double-creates a section that already exists.
    if (claim.causeOfLoss?.length && this.sectionSvc.getByClaimIdSync(claimId).length === 0) {
      // Entity = the property/asset affected, never the claimant's own name
      // (see step-skeleton-summary.ts's onCreate for the same rule) — this
      // claim model only has a coarse city/country, but that still reads
      // sane ("Material damage — Munich") where the client's name doesn't.
      const entityName = claim.location?.city || claim.clientName;
      await firstValueFrom(
        this.sectionSvc.createSectionFromCauseOfLoss(claimId, claim.causeOfLoss, entityName)
      );
    }
    // Reserves still need manual setup — nothing derives a reserve amount
    // from cause of loss the way a section's damage type can be derived.
    // Surfaced as a real task so it's in the same queue as every other
    // piece of work, carrying forward the urgency the skeleton had
    // pre-conversion (3-day SLA) instead of it evaporating at conversion.
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    await firstValueFrom(
      this.taskSvc.create({
        claimId,
        taskType: 'Review',
        description: `Set up reserves for ${claimNumber} (converted from orphan claim ${formerNumber})`,
        status: 'open',
        dueDate: dueDate.toISOString().split('T')[0],
        priority: 'high',
        assignee: claim.assignee ?? 'Unassigned'
      })
    );
    // Marlene confirmed (2026-10-05) that a Location of loss captured during
    // the skeleton stage must be RE-CONFIRMED, not silently carried forward,
    // once a policy is linked — it was entered through the no-policy manual
    // modal (location-picker.component.ts routes to ManualLocationEntryModal
    // when policyNumber is null), so it was never checked against the
    // policy's actual CWB locations. Edit Claim Details' Locations of loss
    // section already re-points the SAME location-picker at the real,
    // policy-aware modal the moment policyNumber is set (no picker-routing
    // fix needed — confirmed), so re-confirming is just a normal edit there.
    // What was missing was anything telling the handler to go do it. Same
    // task-queue mechanism as the reserves task above, not a new pattern —
    // and only fires when there's an existing manually-entered location to
    // recheck; a never-filled-in location already gets its own normal
    // "fill this in" prompt from the empty-state picker.
    const lossInfo = this.stateSvc.state().lossInformation.find(li => li.claimId === claimId);
    const hadManualLocation = !!(
      lossInfo?.lossLocation as unknown as { locations?: unknown[] } | undefined
    )?.locations?.length;
    if (hadManualLocation) {
      await firstValueFrom(
        this.taskSvc.create({
          claimId,
          taskType: 'Review',
          description: `Confirm loss location for ${claimNumber} — entered manually before the policy was linked`,
          status: 'open',
          dueDate: dueDate.toISOString().split('T')[0],
          priority: 'high',
          assignee: claim.assignee ?? 'Unassigned'
        })
      );
    }
    return { claim, locationNeedsReconfirm: hadManualLocation, claimNumber, formerNumber };
  }

  /** Writes the description, cause and CBI answers the handler confirmed at conversion. */
  private async applyCompletion(claim: Claim, d: CompletionDetails): Promise<Claim> {
    const opts = this.lookupSvc.getCauseOfLossSync();
    const labels = (codes: string[] | undefined): string => (codes ?? []).map(c => causeLabel(c, opts)).join(', ') || '–';
    const updated = await firstValueFrom(
      this.claimSvc.update(claim.claimId, { description: d.lossDescription, causeOfLoss: d.causeOfLoss })
    );
    const li = await firstValueFrom(this.lossInfoSvc.getByClaimId(claim.claimId));
    if (li) {
      await firstValueFrom(
        this.lossInfoSvc.save(
          {
            ...li,
            causeOfLoss: d.causeOfLoss,
            lossDescription: d.lossDescription,
            specifyOtherCauseOfLoss: d.specifyOtherCauseOfLoss,
            ...(d.cbi ?? {})
          } as unknown as LossInformationFormValue,
          claim.claimId
        )
      );
    }
    const base = { claimId: claim.claimId, user: claim.assignee ?? 'Unassigned', objectType: 'Claim' as const };
    const stamp = (n: string): { id: string; timestamp: string } => ({ id: `act-${n}-${Date.now()}`, timestamp: new Date().toISOString() });
    const rows: ClaimActivity[] = [];
    if (labels(claim.causeOfLoss) !== labels(d.causeOfLoss)) {
      rows.push({ ...base, ...stamp('cause'), attribute: 'Cause of loss', valueOld: labels(claim.causeOfLoss), valueNew: labels(d.causeOfLoss) });
    }
    if ((claim.description ?? '') !== d.lossDescription) {
      rows.push({ ...base, ...stamp('desc'), attribute: 'Loss description', valueOld: claim.description || '–', valueNew: d.lossDescription });
    }
    if (rows.length) this.appendActivities(claim.claimId, rows);
    return updated;
  }

  // Same re-sync convertToRegularClaim does, exposed for the other skeleton
  // transitions (Abandon / Reopen / Extend SLA) — they write to the Claim
  // record via MockClaimService but, without this, a cached overview (the
  // handler opened this claim's Overview before acting from FNOL search)
  // would keep showing the pre-transition snapshot forever.
  async resyncOverview(claimId: string): Promise<void> {
    const claim = await firstValueFrom(this.claimSvc.getById(claimId));
    this.stateSvc.patchOverview(claimId, this.synthesizeOverviewFromClaim(claim));
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
