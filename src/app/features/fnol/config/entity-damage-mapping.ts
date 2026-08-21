import { EntityType, PromiseStatus } from '../../../core/models/entity-damage.model';

export interface DamageGroupRoute {
  damageType: string;
  damageTypeKey: string;
}

// Routes an entity type to the damage type it falls under by default — a
// distinct concern from the damage-type vocabulary itself (single source:
// lookups.json's typeOfDamage, via MockLookupService). This map only decides
// which of those canonical types a given entityType routes to; it does not
// define its own competing list of types.
export const ENTITY_TYPE_TO_DAMAGE_GROUP: Record<EntityType, DamageGroupRoute> = {
  building:  { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  vehicle:   { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  marine:    { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  employee:  { damageType: 'Bodily injury',   damageTypeKey: 'bodily-injury'   },
  financial: { damageType: 'Financial loss',  damageTypeKey: 'financial-loss'  },
  other:     { damageType: 'Material damage', damageTypeKey: 'material-damage' },
};

export const PROMISE_SECTION_OPTIONS: { key: PromiseStatus; label: string }[] = [
  { key: 'possibly-promised', label: 'Possibly promised entities' },
  { key: 'not-promised',      label: 'Not promised entities'      },
];
