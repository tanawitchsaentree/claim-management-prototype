import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MassEvent, MassEventFilters } from '../../models';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/mass-events.json';

@Injectable({ providedIn: 'root' })
export class MockMassEventService extends MockBaseService {
  private cache: MassEvent[] = (rawData as unknown as MassEvent[]).map(e => ({ ...e }));

  search(filters?: MassEventFilters): Observable<MassEvent[]> {
    const filtered = this.applyFilters(this.cache, filters);
    return this.respond(filtered.map(e => ({ ...e })));
  }

  getById(id: string): Observable<MassEvent | null> {
    const found = this.cache.find(e => e.id === id) ?? null;
    return this.respond(found ? { ...found } : null);
  }

  /** Used by ScenarioOverrides.massEventsAppend so AC tickets can seed events. */
  appendEvents(events: MassEvent[]): void {
    const ids = new Set(this.cache.map(e => e.id));
    const fresh = events.filter(e => !ids.has(e.id));
    this.cache = [...this.cache, ...fresh];
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
