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
  // Synchronous variant — for callers that build data synchronously inside a
  // map()/insert helper (e.g. MockEntitiesDamagesService) and would otherwise
  // need to duplicate the vocabulary just to avoid subscribing. Single source
  // stays lookups.json either way.
  getTypeOfDamageSync(): LookupOption[]                { return this.lookups.typeOfDamage; }
  getLocationTypes(): Observable<LocationTypeOption[]> { return this.respond(this.lookups.locationTypes); }
  getEventCausedBy(): Observable<Record<string, LookupOption[]>> { return this.respond(this.lookups.eventCausedBy); }
  getPartyRoles(): Observable<LookupOption[]>        { return this.respond(this.lookups.partyRoles); }
  getClearanceStatuses(): Observable<LookupOption[]> { return this.respond(this.lookups.clearanceStatuses); }
  getIdTypes(): Observable<LookupOption[]>            { return this.respond(this.lookups.idTypes); }
  getReserveTypes(): Observable<LookupOption[]>       { return this.respond(this.lookups.reserveTypes); }
  getNarrativeOptions(): Observable<LookupOption[]>   { return this.respond(this.lookups.narrativeOptions); }
  // Same reason again — read by add/edit-damaged-item-modal to populate
  // "Financial loss caused by" as a field initialiser.
  getCauseOfLossSync(): LookupOption[]                { return this.lookups.causeOfLoss; }
}
