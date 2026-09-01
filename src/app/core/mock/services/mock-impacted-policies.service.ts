import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ImpactedPolicy } from '../../models/impacted-policy.model';
import { Policy } from '../../models/policy.model';
import { EntitiesDamagesData } from '../../models/entity-damage.model';
import rawImpacted from '../data/impacted-policies.json';
import rawPolicies from '../data/policies.json';
import rawEntities from '../data/entities-damages.json';

interface RawMatch {
  policyNumber: string;
  matchReason:  string;
}

@Injectable({ providedIn: 'root' })
export class MockImpactedPoliciesService extends MockBaseService {
  private readonly matches  = rawImpacted as unknown as Record<string, RawMatch[]>;
  private readonly policies = rawPolicies as unknown as Policy[];
  private readonly entities = rawEntities as unknown as Record<string, EntitiesDamagesData>;

  /**
   * Policies already pulled onto the claim, keyed by base policy. Kept here
   * rather than on the component so the banner stays gone after the handler
   * navigates away from Entities & damages and comes back — the policies are on
   * the claim at that point, and re-offering them would read as a bug.
   */
  private readonly added = new Map<string, Set<string>>();

  getForPolicy(basePolicyId: string): Observable<ImpactedPolicy[]> {
    const alreadyAdded = this.added.get(basePolicyId) ?? new Set<string>();

    const result: ImpactedPolicy[] = [];
    for (const match of this.matches[basePolicyId] ?? []) {
      if (alreadyAdded.has(match.policyNumber)) continue;

      const policy = this.policies.find(p => p.policyNumber === match.policyNumber);
      if (!policy) continue;

      // A policy with no entities left to offer is not worth interrupting the
      // handler over — the banner exists to unblock entity selection.
      const count = this.countEntities(match.policyNumber);
      if (count === 0) continue;

      result.push({
        policyNumber:         policy.policyNumber,
        clientName:           policy.clientName,
        lineOfBusiness:       policy.lineOfBusiness,
        effectiveDate:        policy.effectiveDate,
        expiryDate:           policy.expiryDate,
        status:               policy.status,
        matchReason:          match.matchReason,
        availableEntityCount: count,
      });
    }
    return this.list(result);
  }

  markAdded(basePolicyId: string, policyNumbers: string[]): void {
    const set = this.added.get(basePolicyId) ?? new Set<string>();
    policyNumbers.forEach(p => set.add(p));
    this.added.set(basePolicyId, set);
  }

  resetState(basePolicyId?: string): void {
    if (basePolicyId) this.added.delete(basePolicyId);
    else              this.added.clear();
  }

  private countEntities(policyId: string): number {
    const data = this.entities[policyId];
    if (!data) return 0;
    return data.sections
      .flatMap(s => s.damageGroups.flatMap(g => g.entities))
      .length;
  }
}
