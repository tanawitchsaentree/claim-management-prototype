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
  getPriorities(): Observable<LookupOption[]>          { return this.respond(this.lookups.priorities); }
  getLinesOfBusiness(): Observable<LookupOption[]>     { return this.respond(this.lookups.linesOfBusiness); }
  getCurrencies(): Observable<LookupOption[]>          { return this.respond(this.lookups.currencies); }
  getCountries(): Observable<LookupOption[]>           { return this.respond(this.lookups.countries); }
  getTaskTypes(): Observable<LookupOption[]>           { return this.respond(this.lookups.taskTypes); }
  getCauseOfLoss(): Observable<LookupOption[]>         { return this.respond(this.lookups.causeOfLoss); }
  getTypeOfDamage(): Observable<LookupOption[]>        { return this.respond(this.lookups.typeOfDamage); }
  getWaterSources(): Observable<LookupOption[]>        { return this.respond(this.lookups.waterSources); }
  getLocationTypes(): Observable<LocationTypeOption[]> { return this.respond(this.lookups.locationTypes); }
  getEventCausedBy(): Observable<Record<string, LookupOption[]>> { return this.respond(this.lookups.eventCausedBy); }
  getPartyRoles(): Observable<LookupOption[]>        { return this.respond(this.lookups.partyRoles); }
  getClearanceStatuses(): Observable<LookupOption[]> { return this.respond(this.lookups.clearanceStatuses); }
  getIdTypes(): Observable<LookupOption[]>            { return this.respond(this.lookups.idTypes); }
  getReserveTypes(): Observable<LookupOption[]>       { return this.respond(this.lookups.reserveTypes); }
  getNarrativeOptions(): Observable<LookupOption[]>   { return this.respond(this.lookups.narrativeOptions); }
}
