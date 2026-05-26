import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { delay } from 'rxjs/operators';
import { of } from 'rxjs';
import { CwbLocation, CwbSearchFilters } from '../../models/cwb-location.model';
import { MockBaseService } from './mock-base.service';
import seedData from '../data/cwb-locations.json';

const CWB_DELAY_MS = 500;

@Injectable({ providedIn: 'root' })
export class MockCwbService extends MockBaseService {
  private cache: CwbLocation[] = (seedData as CwbLocation[]).map(c => ({ ...c }));

  search(filters: CwbSearchFilters): Observable<CwbLocation[]> {
    const f = filters;
    const matches = this.cache.filter(loc => {
      if (f.policyNumber && loc.policyNumber !== f.policyNumber) return false;
      if (f.locationRuleNumber && loc.locationRuleNumber !== f.locationRuleNumber) return false;
      if (f.country && loc.country !== f.country) return false;
      if (f.city && !loc.city.toLowerCase().includes(f.city.toLowerCase())) return false;
      if (f.postalCode && !loc.postalCode.startsWith(f.postalCode)) return false;
      if (f.streetAndNumber && !loc.streetAndNumber.toLowerCase().includes(f.streetAndNumber.toLowerCase())) return false;
      return true;
    });
    return of(matches).pipe(delay(CWB_DELAY_MS));
  }

  appendLocations(rows: CwbLocation[]): void {
    const existing = new Set(this.cache.map(r => r.cwbReference));
    for (const r of rows) {
      if (!existing.has(r.cwbReference)) this.cache.push({ ...r });
    }
  }

  resetCache(): void {
    this.cache = (seedData as CwbLocation[]).map(c => ({ ...c }));
  }
}
