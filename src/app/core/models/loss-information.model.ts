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

// CBI (contingent business interruption) — BMPCC-18353. Captured only while
// typeOfDamage includes 'business-interruption' and cbiApplicable === 'yes'.
// Country/city/zip mandatory when present; the rest optional (mirrors the
// legacy ABS field set — see CbiOriginatingLocation in section.model.ts).
export interface CbiLossInfoLocation {
  country: string | null;
  city: string;
  zip: string;
  street?: string;
  houseNumber?: string;
  landRecordNumber?: string;
  state?: string;
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
  cbiApplicable?: 'yes' | 'no' | null;
  cbiCaseType?: string | null;
  cbiThirdPartyName?: string;
  cbiLocation?: CbiLossInfoLocation;
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
  cbiApplicable?: 'yes' | 'no' | null;
  cbiCaseType?: string | null;
  cbiThirdPartyName?: string;
  cbiLocation?: CbiLossInfoLocation;
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
  countries: { value: string; label: string }[];
  causeOfLossOptions: { value: string; label: string }[];
  typeOfDamageOptions: { value: string; label: string }[];
  events: LossEventConfig[];
}
