import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MassEvent, MassEventFilters, Claim, MassEventLinkStatus } from '../../models';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import rawData from '../data/mass-events.json';

@Injectable({ providedIn: 'root' })
export class MockMassEventService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  private cache: MassEvent[] = (rawData as unknown as MassEvent[]).map(e => ({ ...e }));

  search(filters?: MassEventFilters): Observable<MassEvent[]> {
    const filtered = this.applyFilters(this.cache, filters);
    return this.respond(filtered.map(e => ({ ...e })));
  }

  getById(id: string): Observable<MassEvent | null> {
    const found = this.cache.find(e => e.id === id) ?? null;
    return this.respond(found ? { ...found } : null);
  }

  /** All claims currently pointing at this mass event, admin/KCM-only view. */
  getLinkedClaims(massEventId: string): Observable<Claim[]> {
    const linked = this.stateSvc.state().claims.filter(c => c.massEventId === massEventId);
    return this.respond(linked.map(c => ({ ...c })));
  }

  /** Creates a new link in 'pending' state — never auto-confirms. */
  linkClaim(claimId: string, massEventId: string, by: { userId: string; name: string }): Observable<void> {
    const linkedBy = { userId: by.userId, name: by.name, at: new Date().toISOString() };
    this.stateSvc.patchClaims(claims =>
      claims.map(c => c.claimId === claimId
        ? { ...c, massEventId, massEventLinkStatus: 'pending' as MassEventLinkStatus, massEventLinkedBy: linkedBy }
        : c
      )
    );
    this.stateSvc.patchOverview(claimId, { massEventId, massEventLinkStatus: 'pending', massEventLinkedBy: linkedBy });
    return this.respond(undefined);
  }

  confirmLink(claimId: string): Observable<void> {
    this.stateSvc.patchClaims(claims =>
      claims.map(c => c.claimId === claimId ? { ...c, massEventLinkStatus: 'confirmed' as MassEventLinkStatus } : c)
    );
    this.stateSvc.patchOverview(claimId, { massEventLinkStatus: 'confirmed' });
    return this.respond(undefined);
  }

  /**
   * Claim handler override (BMPCC-10510): the mass event tag stays visible —
   * unlike unlinkClaim, this does NOT clear massEventId — but the link status
   * flips to 'overridden' so the UI can show "auto-checks disabled" and the
   * rules engine (real backend, not this mock) knows to stop re-evaluating
   * this claim against the mass event.
   */
  overrideLink(claimId: string, by: { userId: string; name: string }): Observable<void> {
    const overriddenBy = { userId: by.userId, name: by.name, at: new Date().toISOString() };
    this.stateSvc.patchClaims(claims =>
      claims.map(c => c.claimId === claimId
        ? { ...c, massEventLinkStatus: 'overridden' as MassEventLinkStatus, massEventOverriddenBy: overriddenBy }
        : c
      )
    );
    this.stateSvc.patchOverview(claimId, { massEventLinkStatus: 'overridden', massEventOverriddenBy: overriddenBy });
    return this.respond(undefined);
  }

  unlinkClaim(claimId: string): Observable<void> {
    this.stateSvc.patchClaims(claims =>
      claims.map(c => c.claimId === claimId
        ? { ...c, massEventId: undefined, massEventLinkStatus: undefined, massEventLinkedBy: undefined }
        : c
      )
    );
    this.stateSvc.patchOverview(claimId, { massEventId: undefined, massEventLinkStatus: undefined, massEventLinkedBy: undefined });
    return this.respond(undefined);
  }

  /** Used by ScenarioOverrides.massEventsAppend so AC tickets can seed events. */
  appendEvents(events: MassEvent[]): void {
    const ids = new Set(this.cache.map(e => e.id));
    const fresh = events.filter(e => !ids.has(e.id));
    this.cache = [...this.cache, ...fresh];
  }

  /** Persists a newly created event so it's findable via search()/getById() everywhere. */
  addEvent(event: MassEvent): Observable<MassEvent> {
    this.appendEvents([event]);
    return this.respond({ ...event });
  }

  /** IDs already in the shared cache — used to seed the create-modal's next-ID generator. */
  allIds(): string[] {
    return this.cache.map(e => e.id);
  }

  resetState(): void {
    this.cache = (rawData as unknown as MassEvent[]).map(e => ({ ...e }));
  }

  private applyFilters(list: MassEvent[], f?: MassEventFilters): MassEvent[] {
    if (!f) return list;
    return list.filter(e => {
      if (f.id        && !e.id.toLowerCase().includes(f.id.toLowerCase())) return false;
      if (f.code      && !e.code.toLowerCase().includes(f.code.toLowerCase())) return false;
      if (f.name      && !e.name.toLowerCase().includes(f.name.toLowerCase())) return false;
      if (f.country   && e.country !== f.country) return false;
      if (f.region    && e.region  !== f.region)  return false;
      if (f.lossCause && e.lossCause !== f.lossCause) return false;
      if (f.dateStartFrom && e.dateStart < f.dateStartFrom) return false;
      if (f.dateStartTo   && e.dateStart > f.dateStartTo)   return false;
      return true;
    });
  }
}
