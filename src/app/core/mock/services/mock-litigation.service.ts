import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Litigation, LitigationFilters } from '../../models';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/litigations.json';

@Injectable({ providedIn: 'root' })
export class MockLitigationService extends MockBaseService {
  private cache: Litigation[] = (rawData as unknown as Litigation[]).map(l => this.clone(l));

  search(filters?: LitigationFilters): Observable<Litigation[]> {
    let list = this.cache;
    if (filters?.claimId) list = list.filter(l => l.claimId === filters.claimId);
    if (filters?.status)  list = list.filter(l => l.status  === filters.status);
    return this.respond(list.map(l => this.clone(l)));
  }

  getById(id: string): Observable<Litigation | null> {
    const found = this.cache.find(l => l.id === id) ?? null;
    return this.respond(found ? this.clone(found) : null);
  }

  create(claimId: string, clientName: string): Litigation {
    const nextNo = this.cache.filter(l => l.claimId === claimId).length + 1;
    const fresh: Litigation = {
      id:         `${claimId}-LIT-${nextNo}`,
      claimId,
      clientName,
      type:       '',
      startDate:  '',
      status:     'Draft',
      expenses:   [],
      cases:      [],
    };
    this.cache = [fresh, ...this.cache];
    return this.clone(fresh);
  }

  update(updated: Litigation): void {
    this.cache = this.cache.map(l => (l.id === updated.id ? this.clone(updated) : l));
  }

  resetState(): void {
    this.cache = (rawData as unknown as Litigation[]).map(l => this.clone(l));
  }

  private clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
}
