import { Injectable, inject } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { FnolStateService } from '../../../core/services/fnol-state.service';
import { MockImpactedPoliciesService } from '../../../core/mock/services/mock-impacted-policies.service';
import { MockEntitiesDamagesService } from '../../../core/mock/services/mock-entities-damages.service';
import { EntitiesDamagesData, Policy } from '../../../core/models';
import rawPolicies from '../../../core/mock/data/policies.json';

/**
 * BMPCC-22665: the FNOL "Policies" step around the existing impacted-policies
 * suggestion (MockImpactedPoliciesService, the same data the Entities &
 * Damages banner reads).
 *
 * DESIGN DECISION IMP-1 (where the step sits): after Loss information, before
 * Entities & Damages. The coverage check matches on the cause of loss and
 * damage type, so it can only run once those are entered, and the policies
 * chosen here decide whose entities Entities & Damages lists. The step only
 * exists when there is a suggestion (or the check failed and the handler must
 * be told); otherwise the flow is exactly as before. The handler can go back
 * to it from any later step until Submit and change the selection.
 */
@Injectable({ providedIn: 'root' })
export class PolicySelectionService {
  private readonly fnolState = inject(FnolStateService);
  private readonly impactedSvc = inject(MockImpactedPoliciesService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly policies = rawPolicies as unknown as Policy[];

  /** Where Next on Loss information goes. Sets up or removes the Policies step. */
  async routeAfterLossInformation(): Promise<string> {
    const searched = this.fnolState.policyStep?.searched ?? this.fnolState.selectedPolicy;
    if (!searched) return '/fnol/entities-damages';
    const hasStep = await firstValueFrom(
      this.impactedSvc.getSuggestions(searched.policyNumber).pipe(
        map(list => list.length > 0),
        // A failed check is shown on the step (error state), not swallowed.
        catchError(() => of(true))
      )
    );
    if (!hasStep) {
      this.fnolState.policyStep = null;
      return '/fnol/entities-damages';
    }
    this.fnolState.policyStep ??= { searched, selection: null, added: [] };
    return '/fnol/policies';
  }

  policy(policyNumber: string): Policy | null {
    return this.policies.find(p => p.policyNumber === policyNumber) ?? null;
  }

  /**
   * Confirmed selection, in list order. The first selected policy carries the
   * FNOL (Entities & Damages, Parties, Reserves are captured on it); the
   * entities of the other selected policies are pulled into its tree with the
   * same merge the banner uses, tagged with their policy, so each lands on its
   * own claim at Submit. Deselected policies are taken out again.
   */
  async applySelection(selection: string[]): Promise<void> {
    const step = this.fnolState.policyStep;
    if (!step || !selection.length) return;
    step.selection = [...selection];
    const lead = selection[0];
    if (this.fnolState.selectedPolicy?.policyNumber !== lead) {
      this.fnolState.setLeadPolicy({ policyId: lead, policyNumber: lead }, this.policy(lead));
    }
    const wanted = selection.slice(1);
    const merged = this.impactedSvc.addedFor(lead);
    for (const p of merged.filter(m => !wanted.includes(m))) {
      await firstValueFrom(this.entitiesSvc.removeEntitiesFromPolicy(lead, p));
      this.impactedSvc.unmarkAdded(lead, [p]);
    }
    for (const p of wanted.filter(w => !merged.includes(w))) {
      await firstValueFrom(this.entitiesSvc.addEntitiesFromPolicy(lead, p));
      this.impactedSvc.markAdded(lead, [p]);
    }
  }

  /** The part of the lead policy's tree that belongs to one selected policy. */
  entitiesFor(data: EntitiesDamagesData, policyNumber: string, lead: string, others: string[]) {
    const ownedBy = (coveredBy: string | undefined): string => {
      const hit = others.find(o => coveredBy?.endsWith(` · ${o}`));
      return hit ?? lead;
    };
    return {
      ...data,
      sections: data.sections.map(s => ({
        ...s,
        damageGroups: s.damageGroups.map(g => ({
          ...g,
          entities: g.entities.filter(e => ownedBy(e.coveredBy) === policyNumber)
        }))
      }))
    } as EntitiesDamagesData;
  }
}
