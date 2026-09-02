import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, take } from 'rxjs';
import { PrototypeScenarioService } from './prototype-scenario.service';

export const PROTOTYPE_TICKET_PARAM = 'pt';

// Receiving end of PrototypeScenarioService.buildPrototypeUrl(): a link opened in
// a new tab (or pasted into a chat, or bookmarked) carries `?pt=<ticketId>`, and
// this rebuilds that ticket's scenario in the tab that receives it. Nothing is
// carried over from the tab that produced the link — sessionStorage is per-tab,
// so the URL is the only channel there is.
//
// Deliberately split into two phases, because the app is behind an access gate
// and behind a router:
//
//   applyFromUrl()  — an app initializer, so the mock state is seeded BEFORE the
//                     router instantiates the target page. Applying it afterwards
//                     would leave the page rendered against default state and
//                     relying on signal propagation to repaint.
//   runEntryTour()  — after the gate is unlocked, because the tour renderer lives
//                     inside AppComponent's `@if (unlocked())` block. Starting a
//                     tour at boot would run it against a DOM that isn't there.
@Injectable({ providedIn: 'root' })
export class PrototypeEntryService {
  private readonly prototypeSvc = inject(PrototypeScenarioService);
  private readonly router = inject(Router);

  /** Ticket whose scenario was applied from the URL, if any — set by applyFromUrl(). */
  private entryTicketId: string | null = null;
  private appliedRoute: string | null = null;
  private tourStarted = false;

  private readTicketId(): string | null {
    return new URLSearchParams(window.location.search).get(PROTOTYPE_TICKET_PARAM);
  }

  async applyFromUrl(): Promise<void> {
    const ticketId = this.readTicketId();
    if (!ticketId) return;

    await this.prototypeSvc.loadTickets();
    const route = await this.prototypeSvc.applyTicket(ticketId);
    if (!route) return;
    this.entryTicketId = ticketId;
    this.appliedRoute = route;
  }

  async runEntryTour(): Promise<void> {
    if (!this.entryTicketId || !this.appliedRoute || this.tourStarted) return;
    this.tourStarted = true;

    // Let the router's initial navigation land first. Without this the url read
    // below is still '/' (AppComponent.ngOnInit runs during bootstrap, before the
    // first navigation resolves) and this would fire a second navigation that
    // cancels the first.
    await firstValueFrom(this.router.events.pipe(filter((e) => e instanceof NavigationEnd), take(1)));

    // The link already landed on a route. Only navigate when the ticket's own AC
    // route disagrees with it — e.g. the tracker row's prototype_route was typed
    // by hand and points somewhere other than what the AC actually asserts.
    const current = this.router.url.split('?')[0];
    if (current !== this.appliedRoute) {
      await this.router.navigateByUrl(this.appliedRoute);
    }

    const claimId = this.appliedRoute.match(/^\/claims\/([^/]+)\//)?.[1];
    await this.prototypeSvc.runPostLandForTicket(this.entryTicketId, claimId);
  }
}
