import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { PrototypeScenarioService, substituteClaimId, DEMO_CLAIM_ID } from './prototype-scenario.service';
import { TrackerService } from './tracker.service';
import { TourService } from './tour.service';
import { buildArrivalContext, resolveTourSteps } from './arrival-context.builder';
import { ArrivalContext } from '../models/arrival-context.model';
import { TicketWithDetails } from '../models/tracker.model';
import { environment } from '../../../environments/environment';

export const PROTOTYPE_TICKET_PARAM = 'pt';
export const PROTOTYPE_JIRA_KEY_PARAM = 'tk';

// Receiving end of PrototypeScenarioService.buildPrototypeUrl(): a link opened in
// a new tab (or pasted into a chat, or bookmarked) carries `?pt=<ticketId>` and/or
// `?tk=<jiraKey>`, and this rebuilds the scenario AND the orientation in the tab
// that receives it. Nothing is carried over from the tab that produced the link —
// sessionStorage is per-tab, so the URL is the only channel there is.
//
// Two params, because two things can be true independently:
//   pt — a public/tickets/*.json ticket exists: its stateOverrides can be applied
//        and its acceptance criteria/walkthrough can drive a tour. 8 of the 30
//        clickable tracker rows (measured 2026-09-02).
//   tk — the tracker's Jira key. Always present on a link built from a row, even
//        when no ticket file exists, so the other 22 rows still arrive with a
//        title, a build status and a plain statement that no criteria exist,
//        instead of on an unexplained screen.
//
// Deliberately split into two phases, because the app is behind an access gate
// and behind a router:
//
//   applyFromUrl()  — an app initializer, so the mock state is seeded BEFORE the
//                     router instantiates the target page. Applying it afterwards
//                     would leave the page rendered against default state and
//                     relying on signal propagation to repaint.
//   runEntryTour()  — after the gate is unlocked, because the tour renderer and
//                     the arrival panel both live inside AppComponent's
//                     `@if (unlocked())` block. Starting a tour at boot would run
//                     it against a DOM that isn't there.
@Injectable({ providedIn: 'root' })
export class PrototypeEntryService {
  private readonly prototypeSvc = inject(PrototypeScenarioService);
  private readonly trackerSvc = inject(TrackerService);
  private readonly tourSvc = inject(TourService);
  private readonly router = inject(Router);

  /** Non-null once an entry link has been resolved and not yet dismissed. */
  private readonly _arrival = signal<ArrivalContext | null>(null);
  readonly arrival = this._arrival.asReadonly();

  private entryTicketId: string | null = null;
  private entryJiraKey: string | null = null;
  private appliedRoute: string | null = null;
  private entryHandled = false;

  private param(name: string): string | null {
    return new URLSearchParams(window.location.search).get(name);
  }

  async applyFromUrl(): Promise<void> {
    this.entryTicketId = this.param(PROTOTYPE_TICKET_PARAM);
    this.entryJiraKey = this.param(PROTOTYPE_JIRA_KEY_PARAM);
    if (!this.entryTicketId && !this.entryJiraKey) return;

    if (this.entryTicketId) {
      await this.prototypeSvc.loadTickets();
      this.appliedRoute = await this.prototypeSvc.applyTicket(this.entryTicketId);
    }
  }

  async runEntryTour(): Promise<void> {
    if (this.entryHandled) return;
    if (!this.entryTicketId && !this.entryJiraKey) return;
    this.entryHandled = true;

    // Let the router's initial navigation land first. Without this the url read
    // below is still '/' (AppComponent.ngOnInit runs during bootstrap, before the
    // first navigation resolves) and this would fire a second navigation that
    // cancels the first.
    await firstValueFrom(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), take(1)));

    // The link already landed on a route. Only navigate when the ticket's own AC
    // route disagrees with it — e.g. the tracker row's prototype_route was typed
    // by hand and points somewhere other than what the AC actually asserts.
    const landed = this.router.url.split('?')[0];
    if (this.appliedRoute && landed !== this.appliedRoute) {
      await this.router.navigateByUrl(this.appliedRoute);
    }
    const route = this.appliedRoute ?? substituteClaimId(landed, DEMO_CLAIM_ID);

    this._arrival.set(buildArrivalContext({
      route,
      ticket: this.entryTicketId ? this.prototypeSvc.getTicketById(this.entryTicketId) : null,
      row: await this.fetchRow(),
      jiraKey: this.entryJiraKey,
    }));

    // The panel offers the tour; it is not auto-started. Landing mid-tour with a
    // popover already open over the screen is the same "stand here and figure it
    // out" problem in a different costume — a declared postLand sequence is the
    // exception, since that IS the scenario (it opens the modal the AC is about)
    // rather than a narration of it.
    await this.runDeclaredPostLand(route);
  }

  /** Called by the arrival panel's "Start tour". */
  async startTour(): Promise<void> {
    const ticketId = this.entryTicketId;
    const ticket = ticketId ? this.prototypeSvc.getTicketById(ticketId) : null;
    if (!ticket) return;
    await this.tourSvc.start(resolveTourSteps(ticket));
  }

  dismiss(): void {
    this._arrival.set(null);
    this.tourSvc.end();
  }

  // The tracker row is a Supabase read, and the prototype tab is not the tracker
  // — every failure path here degrades to "no row", which the builder handles by
  // falling back to the ticket file (or to the bare route). A prototype screen
  // must never fail to render because an orientation lookup timed out.
  private async fetchRow(): Promise<TicketWithDetails | null> {
    if (!this.entryJiraKey || !environment.trackerEnabled || !environment.supabaseUrl) return null;
    try {
      const { row } = await this.trackerSvc.fetchTicket(this.entryJiraKey);
      return row;
    } catch {
      return null;
    }
  }

  // Only the AC's own declared postLand hooks — the thing that puts the screen
  // into the state the criterion is about (opening the closure modal, prefilling
  // a duplicate). Distinct from the tour, which is narration and stays opt-in.
  private async runDeclaredPostLand(route: string): Promise<void> {
    const ticketId = this.entryTicketId;
    if (!ticketId || !this.appliedRoute) return;
    const ticket = this.prototypeSvc.getTicketById(ticketId);
    const ac = ticket?.acceptanceCriteria.find((a) => a.buildStatus === 'done');
    if (!ac?.setup.postLand?.length) return;
    const claimId = route.match(/^\/claims\/([^/]+)\//)?.[1];
    await this.prototypeSvc.runPostLandForTicket(ticketId, claimId);
  }
}
