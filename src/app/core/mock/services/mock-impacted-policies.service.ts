import { Injectable } from '@angular/core';
import { Observable, delay, throwError } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ImpactedPolicy, PolicyChoice } from '../../models/impacted-policy.model';
import { Policy } from '../../models/policy.model';
import { EntitiesDamagesData } from '../../models/entity-damage.model';
import rawImpacted from '../data/impacted-policies.json';
import rawPolicies from '../data/policies.json';
import rawEntities from '../data/entities-damages.json';

interface RawMatch {
  policyNumber: string;
  matchReason: string;
}

@Injectable({ providedIn: 'root' })
export class MockImpactedPoliciesService extends MockBaseService {
  private readonly matches = rawImpacted as unknown as Record<string, RawMatch[]>;
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
        policyNumber: policy.policyNumber,
        clientName: policy.clientName,
        lineOfBusiness: policy.lineOfBusiness,
        effectiveDate: policy.effectiveDate,
        expiryDate: policy.expiryDate,
        status: policy.status,
        matchReason: match.matchReason,
        availableEntityCount: count
      });
    }
    return this.list(result);
  }

  // ── BMPCC-22665: FNOL "Policies" step ────────────────────────────────
  /** Scenario switches, set from the DEV banner (fnolStateOverride). */
  simulateSuggestionError = false;
  private readonly failCreation = new Set<string>();

  /**
   * Every policy the coverage check suggests for this loss, whether or not it
   * was pulled in already: the step shows the full decision, not what is left.
   */
  getSuggestions(searchedPolicyId: string): Observable<PolicyChoice[]> {
    if (this.simulateSuggestionError) {
      // One-shot, so the demo's Try again shows the check answering.
      this.simulateSuggestionError = false;
      return throwError(() => new Error('Coverage check unavailable')).pipe(delay(400));
    }
    const rows = (this.matches[searchedPolicyId] ?? [])
      .map(m => this.toChoice(m.policyNumber, 'suggested', m.matchReason))
      .filter((c): c is PolicyChoice => !!c);
    return this.respond(rows);
  }

  toChoice(policyNumber: string, source: PolicyChoice['source'], matchReason = ''): PolicyChoice | null {
    const p = this.policies.find(x => x.policyNumber === policyNumber);
    if (!p) return null;
    return {
      policyNumber: p.policyNumber,
      clientName: p.clientName,
      lineOfBusiness: p.lineOfBusiness,
      effectiveDate: p.effectiveDate,
      expiryDate: p.expiryDate,
      currency: p.currency,
      status: p.status,
      matchReason,
      source
    };
  }

  /** Policies already merged into a base policy's entity tree. */
  addedFor(basePolicyId: string): string[] {
    return [...(this.added.get(basePolicyId) ?? [])];
  }

  unmarkAdded(basePolicyId: string, policyNumbers: string[]): void {
    policyNumbers.forEach(p => this.added.get(basePolicyId)?.delete(p));
  }

  setCreationFailures(policyNumbers: string[]): void {
    this.failCreation.clear();
    policyNumbers.forEach(p => this.failCreation.add(p));
  }

  /** True once per policy: the demo failure clears itself, so Retry succeeds. */
  takeCreationFailure(policyNumber: string): boolean {
    return this.failCreation.delete(policyNumber);
  }

  markAdded(basePolicyId: string, policyNumbers: string[]): void {
    const set = this.added.get(basePolicyId) ?? new Set<string>();
    policyNumbers.forEach(p => set.add(p));
    this.added.set(basePolicyId, set);
  }

  resetState(basePolicyId?: string): void {
    if (basePolicyId) this.added.delete(basePolicyId);
    else this.added.clear();
    this.simulateSuggestionError = false;
    this.failCreation.clear();
  }

  private countEntities(policyId: string): number {
    const data = this.entities[policyId];
    if (!data) return 0;
    return data.sections.flatMap(s => s.damageGroups.flatMap(g => g.entities)).length;
  }
}
