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

// Broader many-to-many routing, used only by the Sections "Add Entity"
// modal's damage-type -> entity dropdown. Deliberately looser than
// ENTITY_TYPE_TO_DAMAGE_GROUP above (that one is a strict 1:1 "which group
// does this entity type default into" for the FNOL entities-damages step)
// — this one answers "which entity types can this damage type pull
// candidates from", reusing entity types across more than one damage type
// so all 7 canonical damage types (lookups.json's typeOfDamage) have real
// candidates instead of only the 3 ENTITY_TYPE_TO_DAMAGE_GROUP covers.
export const DAMAGE_TYPE_TO_ENTITY_TYPES: Record<string, EntityType[]> = {
  'material-damage':       ['building', 'vehicle', 'marine', 'other'],
  'business-interruption': ['building', 'financial'],
  'machinery-breakdown':   ['vehicle', 'other'],
  'bodily-injury':         ['employee'],
  'financial-loss':        ['financial'],
  'liability':              ['employee', 'other'],
  'product-recall-costs':  ['financial', 'other'],
};

export const PROMISE_SECTION_OPTIONS: { key: PromiseStatus; label: string }[] = [
  { key: 'possibly-promised', label: 'Possibly promised entities' },
  { key: 'not-promised',      label: 'Not promised entities'      },
];
