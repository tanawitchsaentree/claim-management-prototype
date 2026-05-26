export interface CwbLocation {
  cwbReference: string;
  locationRuleNumber: string;
  policyNumber: string;
  locationName: string;
  country: string;
  city: string;
  postalCode: string;
  streetAndNumber: string;
  latitude: number;
  longitude: number;
  propertyType: string;
}

export interface CwbSearchFilters {
  policyNumber: string;
  locationRuleNumber: string;
  country: string;
  city: string;
  postalCode: string;
  streetAndNumber: string;
  geoCoordinates: string;
}

export interface CwbManualAddress {
  country: string;
  city: string;
  postalCode: string;
  streetAndNumber: string;
  addressLine2?: string;
  state?: string;
  notes?: string;
}

export interface CwbModalResult {
  cwb:    CwbLocation[];
  manual: CwbManualAddress[];
}
