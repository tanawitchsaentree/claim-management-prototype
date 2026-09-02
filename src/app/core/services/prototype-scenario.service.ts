import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { MockStateService, ScenarioOverrides } from '../mock/state/mock-state.service';
import { FnolStateService } from '../../features/fnol/services/fnol-state.service';
import { MockSkeletonClaimService } from '../mock/services/mock-skeleton-claim.service';
import { MockPolicyLocationService } from '../mock/services/mock-policy-location.service';
import { LocationItem } from '../models';
import { ScenarioStageService } from '../scenario/scenario-stage.service';
import { DevTicket, TicketIndex } from '../models/dev-ticket.model';
import { resolveTourSteps } from './arrival-context.builder';

// Tracker rows carry hand-typed routes copied straight out of app.routes.ts,
// param name and all — "/claims/:id/sections". Navigating to that literally
// MATCHES the route with the id ":id", so the page renders against a claim that
// does not exist: verified live, /claims/:id/loss-information/edit shows the
// "Edit claim details" page with ":id" printed where the claim number goes and
// every field reading "Not provided". It looks like data loss and it is not.
// 17 of the 30 clickable tracker rows were doing this.
//
// One substitution point, used by every caller, so the app and
// scripts/gen-tracker-md.mjs (which has done this for its links all along)
// can't drift apart on what a tracker route resolves to.
export const DEMO_CLAIM_ID = 'CLM-2024-001';

export function substituteClaimId(route: string, claimId: string): string {
  return route.replace(/\/:id(?=\/|$)/g, `/${claimId}`);
}

// Single mechanism for applying a ticket's ScenarioOverrides — extracted
// from ClaimDevHelperService (2026-08-20) so the tracker's "Open in
// prototype" bridge and the dev banner call the exact same code path,
// per the "do not build a parallel mechanism" instruction. Lives in
// core/services/ (not features/claims/) specifically so features/tracker
// can inject it without violating the tracker isolation rule (tracker must
// not import from features/claims/fnol/sections — this file can, since
// it's core, and ClaimDevHelperService now delegates to it instead of
// duplicating the logic).
@Injectable({ providedIn: 'root' })
export class PrototypeScenarioService {
  private readonly stateSvc = inject(MockStateService);
  private readonly fnolStateSvc = inject(FnolStateService);
  private readonly skeletonSvc = inject(MockSkeletonClaimService);
  private readonly policyLocationSvc = inject(MockPolicyLocationService);
  private readonly stageSvc = inject(ScenarioStageService);
  private readonly http = inject(HttpClient);

  // Ticket-JSON registry (public/tickets/*.json) — same data
  // ClaimDevHelperService.loadTickets() loads, moved here so the tracker
  // bridge can look tickets up without importing a features/claims file.
  private readonly _tickets = signal<DevTicket[]>([]);
  readonly tickets = this._tickets.asReadonly();

  async loadTickets(): Promise<void> {
    if (this._tickets().length > 0) return;
    const base = document.baseURI;
    const bust = `?t=${Date.now()}`;
    const index = await firstValueFrom(
      this.http.get<TicketIndex>(`${base}tickets/index.json${bust}`).pipe(catchError(() => of(null))),
    );
    if (!index) return;

    const loaded = await Promise.all(
      index.tickets.map((entry) =>
        firstValueFrom(
          this.http.get<DevTicket>(`${base}tickets/${entry.file}${bust}`).pipe(catchError(() => of(null))),
        ),
      ),
    );
    this._tickets.set(loaded.filter((t): t is DevTicket => t !== null));
  }

  getTicketById(id: string): DevTicket | null {
    return this._tickets().find((t) => t.ticketId === id) ?? null;
  }

  // ticket_state.prototype_ticket_id has never had any UI to set it — a tracker ticket's link
  // to its prototype ticket file had to be typed in by hand (a free-text prototype_route field,
  // with no linked state/tour) even though `DevTicket.ticketId` already uses the exact same
  // "BMPCC-NNNN" format as the tracker's own jira_key. Auto-match by that format instead:
  // the explicit DB value always wins if someone did set it, otherwise infer the link from a
  // same-key ticket file. Shared by the tracker table and the detail panel so both agree on
  // what "linked" means.
  resolveTicketId(jiraKey: string, manualTicketId: string | null): string | null {
    if (manualTicketId) return manualTicketId;
    return this.getTicketById(jiraKey) ? jiraKey : null;
  }

  // Pure lookup, no side effects — for display/gating. applyTicket() does the side-effecting
  // version of this same "first done AC's route" lookup when the route is actually opened.
  // Always returns a navigable route: AC routes in public/tickets/*.json are concrete already
  // (checked — 0 of them carry a param), the tracker's hand-typed ones get :id substituted for
  // the linked ticket's own targetClaim, or the demo claim when no ticket file is linked.
  resolveRoute(jiraKey: string, manualTicketId: string | null, manualRoute: string | null): string | null {
    const ticketId = this.resolveTicketId(jiraKey, manualTicketId);
    const ticket = ticketId ? this.getTicketById(ticketId) : null;
    const ac = ticket?.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    if (ac) return ac.howToTest.route;
    if (!manualRoute) return null;
    return substituteClaimId(manualRoute, ticket?.targetClaim ?? DEMO_CLAIM_ID);
  }

  // Absolute URL for opening a scenario in a NEW TAB. `pt` and `tk` are the entry
  // contract PrototypeEntryService reads back on boot over there: sessionStorage
  // is not shared with a new tab, so the state applied in THIS tab cannot travel
  // — the new tab has to rebuild the scenario, and its own orientation, from the
  // URL itself. `tk` is set even when there's no ticket file to apply, because
  // the Jira key alone is enough for the arrival panel to fetch the row and say
  // what the reviewer is looking at. Side effect worth having: the link is now
  // shareable, paste it anywhere and it opens with the scenario applied.
  // Relative to document.baseURI so it works under the gh-pages base href as
  // well as on localhost.
  buildPrototypeUrl(route: string, ticketId: string | null, jiraKey?: string | null): string {
    const url = new URL(route.replace(/^\//, ''), document.baseURI);
    if (ticketId) url.searchParams.set('pt', ticketId);
    if (jiraKey) url.searchParams.set('tk', jiraKey);
    return url.toString();
  }

  // Mirrors runPostLandForTicket()'s own precedence: the first 'done' AC's
  // declared postLand (if any) always wins over the ticket-level tour — a
  // tour bolted onto an already-auto-opened modal would fight it for screen
  // space (see claim-dev-helper.service.ts's tourHooksFor comment). Without
  // this check the tracker's "has tour" badge would promise a tour that
  // clicking through never actually shows.
  hasTour(id: string): boolean {
    const ticket = this.getTicketById(id);
    if (!ticket || !resolveTourSteps(ticket).length) return false;
    const ac = ticket.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    return !ac?.setup.postLand?.length;
  }

  // The tracker links to a whole prototype ticket, not one specific AC —
  // the first 'done' AC is the deterministic stand-in for "the reviewable
  // scenario this ticket represents". Returns null (triggering the plain-
  // navigation fallback in the caller) when there's no linked ticket or no
  // done AC to apply.
  async applyTicket(ticketId: string): Promise<string | null> {
    const ticket = this.getTicketById(ticketId);
    const ac = ticket?.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    if (!ticket || !ac) return null;
    await this.applyOverrides(ac.setup.stateOverrides);
    return ac.howToTest.route;
  }

  // The apply→navigate→postLand chain used to live here as openRoute(), navigating
  // the tracker's own tab. It's gone: launching in a new tab means the sequence has
  // to run in the tab that RECEIVES the link, so PrototypeEntryService owns it now
  // (applyFromUrl before the router, runEntryTour after the access gate) and calls
  // applyTicket() + runPostLandForTicket() here for the two halves it needs.
  async runPostLandForTicket(ticketId: string, claimId?: string): Promise<void> {
    const ticket = this.getTicketById(ticketId);
    const ac = ticket?.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    if (!ticket || !ac) return;
    const declaredHooks = ac.setup.postLand ?? [];
    const tourSteps = resolveTourSteps(ticket);
    const hooks = declaredHooks.length > 0 ? declaredHooks : tourSteps.length > 0 ? [{ kind: 'tour.start' as const, steps: tourSteps }] : [];
    await this.stageSvc.run(hooks, claimId);
  }

  async applyOverrides(overrides: ScenarioOverrides): Promise<void> {
    await this.stateSvc.resetAsync();
    this.stateSvc.loadStatePreset(overrides);
    await this.applyFnolStateOverride(overrides);
    // Let the reset/preset signal writes flush before anything reads state.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  private async applyFnolStateOverride(overrides: ScenarioOverrides): Promise<void> {
    const seed = overrides.fnolStateOverride;
    if (!seed) return;
    this.fnolStateSvc.reset();
    if (seed.selectedClient) this.fnolStateSvc.setSelectedClient(seed.selectedClient);
    if (seed.selectedPolicy) this.fnolStateSvc.setSelectedPolicy(seed.selectedPolicy);
    if (seed.path !== undefined) this.fnolStateSvc.path = seed.path;
    if (seed.convertFromSkeletonId) {
      const skeleton = await firstValueFrom(
        this.skeletonSvc.getById(seed.convertFromSkeletonId).pipe(catchError(() => of(null))),
      );
      if (skeleton) {
        const policyNumber = seed.convertSuggestedPolicyNumber;
        // Resolve the real policy location so loss-info gets a backed
        // PolicyLocation (no hardcoded Munich address). Only the first
        // active location is used; user can edit/replace in the UI.
        let location: LocationItem | undefined;
        if (policyNumber) {
          const locs = await firstValueFrom(
            this.policyLocationSvc.getByPolicyNumber(policyNumber).pipe(catchError(() => of([]))),
          );
          const active = locs.find((l) => l.active) ?? locs[0];
          if (active) {
            location = {
              id: active.id,
              source: 'policy',
              displayName: active.name,
              addressLine1: active.addressLine1,
              postalCode: active.postalCode,
              city: active.city,
              country: active.country,
              propertyId: active.propertyId,
              policyLocationRef: active.id,
            };
          }
        }
        this.fnolStateSvc.prefillFullFromSkeleton(skeleton, { policyNumber, location });
        // Fire the dev-fill bridge that auto-runs Search and pre-selects the
        // matching policy row. Delayed 250ms because Step1SearchComponent
        // subscribes inside its ngOnInit — the Subject has to fire AFTER the
        // router has placed the component in the tree.
        if (policyNumber) {
          setTimeout(() => {
            this.fnolStateSvc.devSearchFill$.next({
              policyNumber,
              clientName: skeleton.clientName ?? '',
            });
          }, 250);
        }
      }
    }
  }
}
