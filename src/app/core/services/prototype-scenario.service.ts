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
import { TourStep } from './tour.service';

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

  hasTour(id: string): boolean {
    const ticket = this.getTicketById(id);
    return !!ticket?.walkthroughSteps.some((s) => typeof s !== 'string');
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

  async runPostLandForTicket(ticketId: string, claimId?: string): Promise<void> {
    const ticket = this.getTicketById(ticketId);
    const ac = ticket?.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    if (!ticket || !ac) return;
    const declaredHooks = ac.setup.postLand ?? [];
    const tourSteps = ticket.walkthroughSteps.filter((s): s is TourStep => typeof s !== 'string');
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
