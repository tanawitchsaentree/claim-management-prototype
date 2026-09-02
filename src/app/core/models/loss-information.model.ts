export interface DateOfLoss {
  dateOfOccurrence: string | null;
  timeOfOccurrence: string | null;
  dateOfNotification: string | null;
  timeOfNotification: string | null;
}

export interface LossLocation {
  locationRequired: boolean;
  locationType: 'listed-in-policy' | 'other' | 'unknown' | null;
  // listed-in-policy branch
  incidentAddress: string;
  incidentAtDifferentLocation: boolean;
  // other branch (manual address)
  street: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country: string | null;
}

export interface LossEvent {
  eventKey: string;
  /** Sub-classification — only present when schema has causedByOptions */
  causedBy?: string[];
  damages: string[];
  /** Per-event dates — only present when schema.hasOwnDates = true */
  dateOfOccurrence?: string | null;
  timeOfOccurrence?: string | null;
  dateOfNotification?: string | null;
  timeOfNotification?: string | null;
  // location?: ManualAddress;  ← will be added with MFE task
}

export interface LossInformationFormValue {
  dateOfLoss: DateOfLoss;
  lossLocation: LossLocation;
  causeOfLoss: string[];
  typeOfDamage: string[];
  /**
   * BMPCC-18160 — one incident circumstance for the whole claim, filtered by
   * the confirmed cause of loss. Single value by design: the AC drifts plural
   * in places, KR1.2 is "select ONE".
   */
  circumstance: string | null;
  /** Free text, captured only while causeOfLoss includes its "Other" option. */
  specifyOtherCauseOfLoss?: string;
  lossDescription: string;
  events: LossEvent[];
}

// Domain entity — what the backend stores
export interface LossInformation {
  id: string;
  claimId: string | null;
  dateOfLoss: DateOfLoss;
  lossLocation: LossLocation;
  causeOfLoss: string[];
  typeOfDamage: string[];
  /** BMPCC-18160. Optional — records seeded before this field existed have none. */
  circumstance?: string | null;
  specifyOtherCauseOfLoss?: string;
  lossDescription: string;
  events: LossEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface LossEventConfig {
  key: string;
  label: string;
}

export interface LossInformationVM {
  loading: boolean;
  error: string | null;
  countries: Array<{ value: string; label: string }>;
  causeOfLossOptions: Array<{ value: string; label: string }>;
  typeOfDamageOptions: Array<{ value: string; label: string }>;
  events: LossEventConfig[];
}
