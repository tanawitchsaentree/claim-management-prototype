import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { SkeletonClaim } from '../../../core/models/skeleton-claim.model';
import { FnolSearchCriteria } from '../../../features/fnol/models/fnol-form.model';
import skeletonData from '../data/skeleton-claims.json';

const STATUS_ORDER: Record<string, number> = {
  'awaiting-policy': 0,
  'matched': 1,
  'abandoned': 2,
};

@Injectable({ providedIn: 'root' })
export class MockSkeletonSearchService extends MockBaseService {
  private readonly skeletons = skeletonData as SkeletonClaim[];

  searchSkeletonClaims(criteria: Partial<FnolSearchCriteria>): Observable<SkeletonClaim[]> {
    const hasAnyCriteria = Object.values(criteria).some(v => v !== null && v !== undefined && v !== '');
    if (!hasAnyCriteria) return this.respond([]);

    let results = [...this.skeletons];

    if (criteria.clientName) {
      const q = criteria.clientName.toLowerCase();
      results = results.filter(s => s.clientName.toLowerCase().includes(q));
    }

    results.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));

    return this.list(results.map(s => this.withComputed(s)));
  }

  private withComputed(s: SkeletonClaim): SkeletonClaim {
    const created = new Date(s.createdDate);
    const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    return { ...s, daysSinceCreation: days };
  }
}
