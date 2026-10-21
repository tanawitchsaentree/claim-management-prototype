import { EntitiesDamagesData, EntityRow } from '../../../../core/models/entity-damage.model';

/** An entity counts as ticked when it, or any of its sub-items, is ticked. */
export function isEntityTicked(entity: EntityRow): boolean {
  return entity.selected || !!entity.subItems?.some(s => s.selected);
}

/**
 * Section rule: a section exists for a damage type when that type was chosen
 * in Loss information AND at least one entity in that group is ticked. The
 * section holds only the ticked entities. Shared by the Summary preview and
 * by claim submit so the two can never disagree.
 */
export function selectedSectionGroups(
  data: EntitiesDamagesData,
  selectedTypes: string[]
): Map<string, EntityRow[]> {
  const result = new Map<string, EntityRow[]>();
  for (const group of data.sections.flatMap(s => s.damageGroups)) {
    if (selectedTypes.length && !selectedTypes.includes(group.damageTypeKey)) continue;
    const ticked = group.entities.filter(isEntityTicked);
    if (!ticked.length) continue;
    result.set(group.damageTypeKey, [...(result.get(group.damageTypeKey) ?? []), ...ticked]);
  }
  return result;
}
