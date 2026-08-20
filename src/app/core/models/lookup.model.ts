export interface LookupOption {
  value: string;
  label: string;
}

export interface LocationTypeOption {
  value: string;
  label: string;
  description: string;
}

export interface CircumstanceLookups {
  byPeril: Record<string, LookupOption[]>;
  fallback: LookupOption[];
}

export interface Lookups {
  claimStatuses: LookupOption[];
  taskStatuses: LookupOption[];
  priorities: LookupOption[];
  linesOfBusiness: LookupOption[];
  currencies: LookupOption[];
  countries: LookupOption[];
  taskTypes: LookupOption[];
  causeOfLoss: LookupOption[];
  typeOfDamage: LookupOption[];
  waterSources: LookupOption[];
  locationTypes: LocationTypeOption[];
  eventCausedBy: Record<string, LookupOption[]>;
  partyRoles: LookupOption[];
  clearanceStatuses: LookupOption[];
  idTypes: LookupOption[];
  reserveTypes: LookupOption[];
  narrativeOptions: LookupOption[];
  circumstances: CircumstanceLookups;
}
