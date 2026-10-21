import {
  DamageGroup,
  EntitiesDamagesData,
  EntityRow,
  EntityStatus,
  SubItem
} from '../../../core/models';

/**
 * Display model for the Entities & Damages tree.
 *
 * The cached data is organised by cover ("Possibly promised" / "Not promised"),
 * then by damage type. The handler sees one list grouped by damage type only,
 * with the cover shown as a status chip on each row, so the tree is rebuilt
 * from the cache here. The cache itself is not changed.
 */
export interface EntityFilter {
  text: string;
  status: EntityStatus | '';
  selectedOnly: boolean;
}

export const NO_FILTER: EntityFilter = { text: '', status: '', selectedOnly: false };

export interface TreeRow {
  entity: EntityRow;
  /** Entities the handler added under a policy rule; empty for ordinary rows. */
  children: EntityRow[];
}

export interface TreeGroup {
  key: string;
  label: string;
  expanded: boolean;
  rows: TreeRow[];
  /** The cached groups merged into this one (one per cover). */
  sources: DamageGroup[];
}

// ── Selection helpers (an entity is ticked itself or through its sub-items) ──

export function hasAnySelection(entity: EntityRow): boolean {
  return entity.subItems?.length ? entity.subItems.some(s => s.selected) : entity.selected;
}

export function isChecked(entity: EntityRow): boolean {
  return entity.subItems?.length ? entity.subItems.every(s => s.selected) : entity.selected;
}

export function isIndeterminate(entity: EntityRow): boolean {
  if (!entity.subItems?.length) return false;
  const n = entity.subItems.filter(s => s.selected).length;
  return n > 0 && n < entity.subItems.length;
}

export function toggleEntity(entity: EntityRow, checked: boolean): void {
  entity.subItems?.forEach(s => (s.selected = checked));
  entity.selected = checked;
}

export function toggleSubItem(entity: EntityRow, sub: SubItem, checked: boolean): void {
  sub.selected = checked;
  entity.selected = entity.subItems!.every(s => s.selected);
}

export function isFilterActive(f: EntityFilter): boolean {
  return !!f.text.trim() || !!f.status || f.selectedOnly;
}

// ── Tree building ────────────────────────────────────────────────────────────

function matches(entity: EntityRow, f: EntityFilter): boolean {
  const text = f.text.trim().toLowerCase();
  if (text && !entity.name.toLowerCase().includes(text)) return false;
  if (f.status && entity.status !== f.status) return false;
  if (f.selectedOnly && !hasAnySelection(entity)) return false;
  return true;
}

export function buildTree(data: EntitiesDamagesData, f: EntityFilter): TreeGroup[] {
  const merged = new Map<string, TreeGroup>();
  const entitiesByGroup = new Map<string, EntityRow[]>();
  for (const section of data.sections) {
    for (const group of section.damageGroups) {
      let tree = merged.get(group.damageTypeKey);
      if (!tree) {
        tree = {
          key: group.damageTypeKey,
          label: group.damageType,
          expanded: group.expanded,
          rows: [],
          sources: []
        };
        merged.set(group.damageTypeKey, tree);
        entitiesByGroup.set(group.damageTypeKey, []);
      }
      tree.sources.push(group);
      entitiesByGroup.get(group.damageTypeKey)!.push(...group.entities);
    }
  }

  const active = isFilterActive(f);
  for (const tree of merged.values()) {
    const all = entitiesByGroup.get(tree.key)!;
    const ruleIds = new Set(all.filter(e => e.isRule).map(e => e.entityId));
    const kids = (id: string) => all.filter(e => e.parentRuleId === id);
    for (const entity of all) {
      if (entity.parentRuleId && ruleIds.has(entity.parentRuleId)) continue;
      if (entity.isRule) {
        const shown = kids(entity.entityId).filter(c => matches(c, f));
        const ruleItself = !f.selectedOnly && matches(entity, f);
        if (!active || shown.length || ruleItself) {
          tree.rows.push({ entity, children: active ? shown : kids(entity.entityId) });
        }
      } else if (matches(entity, f)) {
        tree.rows.push({ entity, children: [] });
      }
    }
  }
  return [...merged.values()].filter(t => !active || t.rows.length > 0);
}

/** Named entities on screen: policy rules are rules, not entities. */
export function countEntities(groups: TreeGroup[]): number {
  return groups.reduce(
    (n, g) => n + g.rows.reduce((m, r) => m + (r.entity.isRule ? 0 : 1) + r.children.length, 0),
    0
  );
}

export function setGroupExpanded(group: TreeGroup, expanded: boolean): void {
  group.expanded = expanded;
  group.sources.forEach(s => (s.expanded = expanded));
}

/**
 * Cause of loss -> Type of damage -> Entities & Damages is one chain
 * (production reference, 2026-09-25): every Type of damage chosen on Loss
 * information gets a group here, even when the policy promises nothing for it.
 * Such a group is empty ("No location selected"), not dropped. The cache knows
 * only what the policy promises, not what was reported, so the reconciling
 * happens here and the cache is left alone.
 */
export function seedEmptyGroups(
  data: EntitiesDamagesData,
  selectedTypes: string[],
  labelFor: (key: string) => string
): EntitiesDamagesData {
  if (!selectedTypes.length) return data;

  const sections = data.sections.map(section => ({
    ...section,
    damageGroups: section.damageGroups.filter(g => selectedTypes.includes(g.damageTypeKey))
  }));
  const present = new Set(sections.flatMap(s => s.damageGroups.map(g => g.damageTypeKey)));
  const missing: DamageGroup[] = selectedTypes
    .filter(key => !present.has(key))
    .map(key => ({ damageType: labelFor(key), damageTypeKey: key, expanded: true, entities: [] }));
  if (!missing.length) return { sections };

  const target = sections.find(s => s.promiseStatus === 'possibly-promised');
  if (target) {
    target.damageGroups = [...target.damageGroups, ...missing];
    return { sections };
  }
  return {
    sections: [
      ...sections,
      {
        promiseStatus: 'possibly-promised',
        label: 'Possibly promised entities',
        expanded: true,
        damageGroups: missing
      }
    ]
  };
}
