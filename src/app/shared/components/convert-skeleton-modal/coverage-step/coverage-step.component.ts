import { Component, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { Claim } from '../../../../core/models/claim.model';
import { SectionPlan } from '../../../../core/models/claim-completion.model';
import { EntitiesDamagesData, EntityRow, SubItem } from '../../../../core/models';
import { PolicySearchResult } from '../../../../features/fnol/models/fnol-form.model';
import { EntitiesTableComponent } from '../../entities-selection/entities-table/entities-table.component';
import {
  NO_FILTER,
  TreeGroup,
  buildTree,
  seedEmptyGroups,
  setGroupExpanded,
  toggleEntity,
  toggleSubItem
} from '../../entities-selection/entity-tree';
import { selectedSectionGroups } from '../../entities-selection/selected-section-groups';

// Step 3 of the Link policy sheet: which of this policy's coverages the loss
// triggers. The same Entities & Damages table FNOL uses, in ticking-only mode;
// every ticked damage type becomes a section when the claim is linked.
@Component({
  selector: 'app-coverage-step',
  standalone: true,
  imports: [NxButtonModule, NxMessageModule, NxSpinnerModule, EntitiesTableComponent],
  templateUrl: './coverage-step.component.html',
  styleUrl: './coverage-step.component.scss'
})
export class CoverageStepComponent {
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly skeleton = input.required<Claim>();
  readonly policy = input.required<PolicySearchResult>();
  /** Causes the handler confirmed, to open the damage type that matches first. */
  readonly causes = input<string[]>([]);
  readonly back = output<void>();
  readonly confirmed = output<SectionPlan[]>();

  readonly loading = signal(true);
  private data: EntitiesDamagesData = { sections: [] };
  /** Ticks and expand/collapse change the loaded objects in place; this re-reads them. */
  private readonly rev = signal(0);
  readonly attempted = signal(false);
  readonly groups = computed<TreeGroup[]>(() => {
    this.rev();
    return buildTree(this.data, NO_FILTER);
  });
  /** Nothing to tick (the policy lists no entities): one section is built from the cause. */
  readonly empty = computed(() => !this.loading() && this.groups().every(g => g.rows.length === 0));
  readonly ticked = computed(() => {
    this.rev();
    return selectedSectionGroups(this.data, []).size;
  });

  constructor() {
    queueMicrotask(() => void this.load());
  }

  private async load(): Promise<void> {
    const cached = await firstValueFrom(this.entitiesSvc.getByPolicyId(this.policy().policyNumber));
    // A private copy: ticking here must not leak into a later FNOL on the same policy.
    const copy = structuredClone(cached);
    const labels = this.lookupSvc.getTypeOfDamageSync();
    const wanted = this.causes().includes('business-interruption') ? 'business-interruption' : 'material-damage';
    // Every damage type the policy lists stays tickable (a skeleton has no "type of damage" yet);
    // the one the cause points to is added empty if the policy lists nothing for it.
    const keys = [...new Set([...copy.sections.flatMap(sec => sec.damageGroups.map(g => g.damageTypeKey)), wanted])];
    this.data = seedEmptyGroups(copy, keys, k => labels.find(o => o.value === k)?.label ?? k);
    this.loading.set(false);
    this.bump();
  }

  bump(): void {
    this.rev.update(n => n + 1);
  }

  onEntityToggle(e: { entity: EntityRow; checked: boolean }): void {
    toggleEntity(e.entity, e.checked);
    this.bump();
  }

  onSubItemToggle(e: { entity: EntityRow; sub: SubItem; checked: boolean }): void {
    toggleSubItem(e.entity, e.sub, e.checked);
    this.bump();
  }

  onToggleGroup(group: TreeGroup): void {
    setGroupExpanded(group, !group.expanded);
    this.bump();
  }

  onToggleAll(expanded: boolean): void {
    this.groups().forEach(g => setGroupExpanded(g, expanded));
    this.bump();
  }

  onToggleRule(rule: EntityRow): void {
    rule.expanded = !rule.expanded;
    this.bump();
  }

  onNext(): void {
    this.attempted.set(true);
    // A policy with nothing to tick still converts: one section is built from the cause.
    if (!this.empty() && this.ticked() === 0) return;
    const plans: SectionPlan[] = [...selectedSectionGroups(this.data, [])].map(([damageType, rows]) => ({
      damageType,
      entityNames: rows.map(r => r.name)
    }));
    this.confirmed.emit(plans);
  }
}
