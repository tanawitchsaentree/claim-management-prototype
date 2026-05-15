export type PromiseStatus     = 'possibly-promised' | 'not-promised';
export type EntityStatus      = 'promised' | 'conditional' | 'by-extension' | 'not-promised';
export type DamageItemStatus  = 'open' | 'assessed' | 'approved' | 'rejected';

export interface UploadedDocument {
  fileId:     string;
  fileName:   string;
  fileSize:   number;   // bytes
  uploadedAt: string;   // ISO date string
}

export interface DamageItem {
  itemId:      string;
  description: string;          // e.g. "Roof damage", "Broken window"
  causeOfLoss: string;          // cause key from cause-schemas
  amount:      number;          // estimated value
  currency:    string;          // "EUR", "USD"
  status:      DamageItemStatus;
  notes?:      string;
  documents?:  UploadedDocument[];
}

export type EntityType =
  | 'building'
  | 'vehicle'
  | 'marine'
  | 'employee'
  | 'financial'
  | 'other';

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  building:  'Add building(s)',
  vehicle:   'Add vehicle(s)',
  marine:    'Add marine vessel(s)',
  employee:  'Add employee group(s)',
  financial: 'Add financial asset(s)',
  other:     'Add other entity',
};

export const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: 'Germany',        label: 'Germany' },
  { value: 'France',         label: 'France' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Netherlands',    label: 'Netherlands' },
];

export interface EntitySearchResult {
  propertyId: string;
  locationName: string;
  streetAndNumber: string;
  city: string;
  country: string;
  zipCode?: string;
  entityType: EntityType;
}

export interface EntitySearchFilters {
  locationRuleNumber?: string;
  country?: string;
  city?: string;
  zipOrPostalCode?: string;
  streetAndNumber?: string;
  locationName?: string;
}

export interface SubItem {
  itemId: string;
  name: string;
  selected: boolean;
}

export interface EntityRow {
  entityId: string;
  name: string;
  status: EntityStatus;
  promiseStatus: PromiseStatus;
  limit: string;
  coveredBy: string;
  coveredForEvents?: string[];
  documentsCount: number;
  selected: boolean;
  subItems?: SubItem[];
  expanded?: boolean;
  damageTypeKey?: string;
  entityType?: EntityType;
  propertyId?: string;
  damageItems?: DamageItem[];
  recentlyAdded?: boolean;
}

export interface DamageGroup {
  damageType: string;
  damageTypeKey: string;
  expanded: boolean;
  entities: EntityRow[];
}

export interface PromiseSection {
  promiseStatus: PromiseStatus;
  label: string;
  expanded: boolean;
  damageGroups: DamageGroup[];
}

export interface EntitiesDamagesData {
  sections: PromiseSection[];
}
