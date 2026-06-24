import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ProviderAssignment, ProviderAssignmentFilters } from '../../models/provider-assignment.model';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/provider-assignments.json';

@Injectable({ providedIn: 'root' })
export class MockProviderService extends MockBaseService {
  private cache: ProviderAssignment[] = (rawData as unknown as ProviderAssignment[]).map(a => this.clone(a));

  search(filters?: ProviderAssignmentFilters): Observable<ProviderAssignment[]> {
    let list = this.cache;
    if (filters?.claimId)      list = list.filter(a => a.claimId      === filters.claimId);
    if (filters?.sectionId)    list = list.filter(a => a.sectionId    === filters.sectionId);
    if (filters?.providerType) list = list.filter(a => a.providerType === filters.providerType);
    if (filters?.status)       list = list.filter(a => a.status       === filters.status);
    return this.respond(list.map(a => this.clone(a)));
  }

  getActiveAssignmentsForClaim(claimId: string): Observable<ProviderAssignment[]> {
    const active = this.cache
      .filter(a => a.claimId === claimId && a.status === 'Active')
      .map(a => this.clone(a));
    return this.respond(active);
  }

  resetCache(): void {
    this.cache = (rawData as unknown as ProviderAssignment[]).map(a => this.clone(a));
  }

  private clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
}
