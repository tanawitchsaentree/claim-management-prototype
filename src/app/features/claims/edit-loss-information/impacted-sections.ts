import { ClaimSection } from '../../../core/models/section.model';

/**
 * "Which sections does this edit hit?" — computed before the user confirms.
 *
 * Marlene's feedback (2026-09-01): on the Edit claim screen, warn about the
 * sections getting impacted so the user can see what's about to change BEFORE
 * they hit confirm. Until now the only signals were a generic sentence in the
 * confirm modal ("review the Sections page afterwards") and a review banner
 * that arrived after the save had already happened.
 *
 * Two grades of truth here, and the UI labels them differently on purpose:
 *  - 'damage-removed' / 'damage-added' are structural. ClaimSection.damageType
 *    holds one canonical typeOfDamage key, so removing a damage type from the
 *    claim provably orphans every open section carrying it, and adding one
 *    provably leaves a damage type with no section behind it.
 *  - 'coverage-review' is a heuristic. Nothing on ClaimSection or SectionEntity
 *    points back at a cause-of-loss or location key, so a cause/location edit
 *    can only be reported as "re-check these", never as "these are wrong".
 *
 * Nothing is applied automatically either way — this function only describes.
 */

export type SectionImpactKind = 'damage-removed' | 'damage-added' | 'coverage-review';

export interface SectionImpact {
  kind: SectionImpactKind;
  /** Existing section this applies to — empty for 'damage-added': none exists yet. */
  sectionName: string;
  damageLabel: string;
  entityCount: number;
}

export interface SectionImpactInput {
  sections: ClaimSection[];
  originalDamageKeys: string[];
  updatedDamageKeys: string[];
  /** typeOfDamage key -> human label, from MockLookupService.getTypeOfDamage(). */
  damageLabel: (key: string) => string;
  /** Diff labels currently pending, i.e. LossInfoDiffField.label values. */
  changedLabels: string[];
}

// A change to either of these re-opens the coverage question on every open
// section. Kept separate from IMPACT_LABELS: 'Type of damages' is handled
// structurally above, not as a blanket re-check.
const COVERAGE_LABELS = ['Cause of loss', 'Loss location'];

export function computeSectionImpacts(input: SectionImpactInput): SectionImpact[] {
  // Closed sections are deliberately out of scope — their coverage question was
  // settled when they were closed, and re-opening one is its own explicit action.
  const open = input.sections.filter(s => s.status === 'Open');
  const removed = input.originalDamageKeys.filter(k => !input.updatedDamageKeys.includes(k));
  const added   = input.updatedDamageKeys.filter(k => !input.originalDamageKeys.includes(k));

  const impacts: SectionImpact[] = [];

  for (const section of open) {
    if (!removed.includes(section.damageType)) continue;
    impacts.push({
      kind: 'damage-removed',
      sectionName: section.name,
      damageLabel: input.damageLabel(section.damageType),
      entityCount: section.entities.length,
    });
  }

  for (const key of added) {
    // A damage type that already has an open section needs nothing — this
    // happens when the claim's typeOfDamage list had drifted behind the
    // sections that were actually created.
    if (open.some(s => s.damageType === key)) continue;
    impacts.push({ kind: 'damage-added', sectionName: '', damageLabel: input.damageLabel(key), entityCount: 0 });
  }

  if (input.changedLabels.some(l => COVERAGE_LABELS.includes(l))) {
    const orphaned = new Set(impacts.filter(i => i.kind === 'damage-removed').map(i => i.sectionName));
    for (const section of open) {
      // Already reported as orphaned — listing it twice would read as two
      // separate problems on the same section.
      if (orphaned.has(section.name)) continue;
      impacts.push({
        kind: 'coverage-review',
        sectionName: section.name,
        damageLabel: input.damageLabel(section.damageType),
        entityCount: section.entities.length,
      });
    }
  }

  return impacts;
}
