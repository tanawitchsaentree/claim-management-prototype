import { EntityType, PromiseStatus } from '../../../core/models/entity-damage.model';

export interface DamageGroupRoute {
  damageType: string;
  damageTypeKey: string;
}

export const ENTITY_TYPE_TO_DAMAGE_GROUP: Record<EntityType, DamageGroupRoute> = {
  building:  { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  vehicle:   { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  marine:    { damageType: 'Material damage', damageTypeKey: 'material-damage' },
  employee:  { damageType: 'Bodily injury',   damageTypeKey: 'bodily-injury'   },
  financial: { damageType: 'Financial loss',  damageTypeKey: 'financial-loss'  },
  other:     { damageType: 'Material damage', damageTypeKey: 'material-damage' },
};

export const DAMAGE_GROUP_OPTIONS: { key: string; label: string }[] = [
  { key: 'material-damage', label: 'Material damage' },
  { key: 'financial-loss',  label: 'Financial loss'  },
  { key: 'bodily-injury',   label: 'Bodily injury'   },
  { key: 'liability',       label: 'Liability'       },
];

export const PROMISE_SECTION_OPTIONS: { key: PromiseStatus; label: string }[] = [
  { key: 'possibly-promised', label: 'Possibly promised entities' },
  { key: 'not-promised',      label: 'Not promised entities'      },
];
