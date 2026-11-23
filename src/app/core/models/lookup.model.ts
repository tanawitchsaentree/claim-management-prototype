export interface LookupOption {
  value: string;
  label: string;
}

// The lookups.json causeOfLoss value that reveals a free-text qualifier,
// "Specify other cause of loss". It lives here, next to the shape of the data
// it belongs to, because both FNOL loss-information and the claims edit page
// have to agree on it and a cross-feature import between the two is not
// allowed. Two copies of a magic string is how one of those surfaces silently
// stops revealing its field.
//
// There is deliberately NO equivalent for typeOfDamage. Real production has a
// specifyOtherTypeOfDamage field, but `other-damage` was removed from this
// prototype's typeOfDamage vocabulary on 2026-08-21 (see CONVERSIONS.md) —
// ClaimSection.damageType is derived from these values, and a catch-all type
// produces a section whose coverage means nothing. Adding the qualifier field
// without that option would just be an affordance nothing can ever trigger.
export const OTHER_CAUSE_KEY = 'other-event';

export interface LocationTypeOption {
  value: string;
  label: string;
  description: string;
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
  reserveSubTypes: LookupOption[];
  // FNOL Reserves editor: sub-types offered on each tab (Indemnity / Expenses / Recoveries).
  reserveSubTypesByType: Record<'indemnity' | 'expenses' | 'recoveries', LookupOption[]>;
  narrativeOptions: LookupOption[];
  cbiCaseTypes: LookupOption[];
  /** CBI Service Interruption: which utility failed (CBI functional design diagram). */
  cbiUtilityTypes: LookupOption[];
  operatingEntities: LookupOption[];
  /** Provider management: kind of external provider assigned to a claim. */
  providerTypes: LookupOption[];
  /** FNOL skeleton claim: why the claim is registered without a policy. */
  skeletonReasons: LookupOption[];
  /** Claim notes: the category a note is filed under. */
  noteCategories: LookupOption[];
}
