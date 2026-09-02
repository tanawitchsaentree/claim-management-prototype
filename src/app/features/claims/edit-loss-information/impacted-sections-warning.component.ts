import { Component, computed, input } from '@angular/core';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { SectionImpact } from './impacted-sections';

/**
 * Pre-confirm warning: which sections this loss-information edit hits.
 *
 * Used twice on purpose — inline on the Edit claim details screen (so the
 * consequence is visible while the user is still editing) and inside the
 * confirm modal (so it is also the last thing read before Confirm). Same
 * component both places, so the two can't drift apart.
 */
@Component({
  selector: 'app-impacted-sections-warning',
  standalone: true,
  imports: [NxMessageModule],
  templateUrl: './impacted-sections-warning.component.html',
  styleUrl: './impacted-sections-warning.component.scss',
})
export class ImpactedSectionsWarningComponent {
  readonly impacts = input.required<SectionImpact[]>();

  readonly removed = computed(() => this.impacts().filter(i => i.kind === 'damage-removed'));
  readonly added   = computed(() => this.impacts().filter(i => i.kind === 'damage-added'));
  readonly review  = computed(() => this.impacts().filter(i => i.kind === 'coverage-review'));

  /** Distinct existing sections named — 'damage-added' rows have no section. */
  readonly sectionCount = computed(
    () => new Set(this.impacts().filter(i => i.sectionName).map(i => i.sectionName)).size,
  );

  readonly headline = computed(() => {
    const sections = this.sectionCount();
    const added = this.added().length;
    const sectionPart = `${sections} open section${sections === 1 ? '' : 's'} impacted`;
    const addedPart = `${added} damage type${added === 1 ? '' : 's'} with no section yet`;
    if (sections && added) return `${sectionPart} · ${addedPart}`;
    return sections ? sectionPart : addedPart;
  });

  entityText(count: number): string {
    return `${count} ${count === 1 ? 'entity' : 'entities'}`;
  }
}
