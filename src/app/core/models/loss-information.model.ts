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

export interface FireDetails {
  fireOrigin: string;
  fireDepartmentCalled: boolean | null;
  fireDepartmentReportNumber: string;
}

export interface WaterDamageDetails {
  waterSource: string | null;
  affectedAreaSqm: number | null;
}

export interface TheftDetails {
  policeReportNumber: string;
  estimatedValueStolen: number | null;
  dateReportedToPolice: string | null;
}

export interface CauseDetails {
  fire: FireDetails;
  waterDamage: WaterDamageDetails;
  theft: TheftDetails;
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
  lossDescription: string;
  causeDetails: CauseDetails;
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
  lossDescription: string;
  causeDetails: Partial<CauseDetails>;
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
  waterSources: Array<{ value: string; label: string }>;
  showFireDetails: boolean;
  showWaterDetails: boolean;
  showTheftDetails: boolean;
  showCauseDetailsSection: boolean;
  events: LossEventConfig[];
}
