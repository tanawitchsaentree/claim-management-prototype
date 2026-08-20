import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Lookups, LookupOption, LocationTypeOption } from '../../models';
import { MockBaseService } from './mock-base.service';
import lookupsData from '../data/lookups.json';

@Injectable({ providedIn: 'root' })
export class MockLookupService extends MockBaseService {
  private readonly lookups = lookupsData as unknown as Lookups;

  getAll(): Observable<Lookups> {
    return this.respond(this.lookups);
  }

  getClaimStatuses(): Observable<LookupOption[]>      { return this.respond(this.lookups.claimStatuses); }
  getTaskStatuses(): Observable<LookupOption[]>        { return this.respond(this.lookups.taskStatuses); }
  getCurrencies(): Observable<LookupOption[]>          { return this.respond(this.lookups.currencies); }
  getCountries(): Observable<LookupOption[]>           { return this.respond(this.lookups.countries); }
  getTaskTypes(): Observable<LookupOption[]>           { return this.respond(this.lookups.taskTypes); }
  getCauseOfLoss(): Observable<LookupOption[]>         { return this.respond(this.lookups.causeOfLoss); }
  getTypeOfDamage(): Observable<LookupOption[]>        { return this.respond(this.lookups.typeOfDamage); }
  getLocationTypes(): Observable<LocationTypeOption[]> { return this.respond(this.lookups.locationTypes); }
  getEventCausedBy(): Observable<Record<string, LookupOption[]>> { return this.respond(this.lookups.eventCausedBy); }
  getPartyRoles(): Observable<LookupOption[]>        { return this.respond(this.lookups.partyRoles); }
  getClearanceStatuses(): Observable<LookupOption[]> { return this.respond(this.lookups.clearanceStatuses); }
  getIdTypes(): Observable<LookupOption[]>            { return this.respond(this.lookups.idTypes); }
  getReserveTypes(): Observable<LookupOption[]>       { return this.respond(this.lookups.reserveTypes); }
  getNarrativeOptions(): Observable<LookupOption[]>   { return this.respond(this.lookups.narrativeOptions); }

  // BMPCC-18160: single-select circumstance field, dynamically filtered by the
  // section's CONFIRMED peril. No confirmed peril (or an "other"/unnamed one)
  // falls back to the full list plus an explicit "Unknown" entry.
  getCircumstances(confirmedPeril?: string): Observable<LookupOption[]> {
    const byPeril = this.lookups.circumstances.byPeril[confirmedPeril ?? ''];
    return this.respond(byPeril ?? this.lookups.circumstances.fallback);
  }
}
