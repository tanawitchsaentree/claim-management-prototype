import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { PolicySearchResult, FnolSearchCriteria } from '../../../features/fnol/models/fnol-form.model';
import policiesData from '../data/policies.json';

@Injectable({ providedIn: 'root' })
export class MockPolicySearchService extends MockBaseService {
  private readonly policies = policiesData as PolicySearchResult[];

  // Full list — used by the skeleton-convert modal which evaluates eligibility
  // (client match + coverage period) against the complete policy set.
  getAllPolicies(): Observable<PolicySearchResult[]> {
    return this.list([...this.policies]);
  }

  searchPolicies(criteria: Partial<FnolSearchCriteria>): Observable<PolicySearchResult[]> {
    const hasAnyCriteria = Object.values(criteria).some(v => v !== null && v !== undefined && v !== '');
    if (!hasAnyCriteria) {
      return this.respond([]);
    }

    let results = [...this.policies];

    if (criteria.clientName) {
      const q = criteria.clientName.toLowerCase();
      results = results.filter(p => p.clientName.toLowerCase().includes(q));
    }
    if (criteria.policyNumber) {
      const q = criteria.policyNumber.toLowerCase();
      results = results.filter(p => p.policyNumber.toLowerCase().includes(q));
    }
    if (criteria.underwritingYear) {
      results = results.filter(p => p.effectiveDate?.startsWith(criteria.underwritingYear!));
    }
    if (criteria.broker) {
      const q = criteria.broker.toLowerCase();
      results = results.filter(p => p.broker?.toLowerCase().includes(q));
    }

    return this.list(results);
  }
}
