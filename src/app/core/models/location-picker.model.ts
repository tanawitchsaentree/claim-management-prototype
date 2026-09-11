export interface PolicyLocation {
  id: string;
  policyNumber: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country: string;
  state?: string;
  propertyId?: string;
  type: string;
  active: boolean;
}

export interface LocationItem {
  id: string;
  source: 'policy' | 'manual' | 'coordinates' | 'cwb';
  displayName: string;
  addressLine1: string;
  addressLine2?: string;
  postalCode: string;
  city: string;
  country: string;
  state?: string;
  propertyId?: string;
  latitude?: number;
  longitude?: number;
  additionalInfo?: string;
  policyLocationRef?: string;
  cwbReference?: string;
  locationRuleNumber?: string;
}

export interface LocationPickerOutput {
  locations: LocationItem[];
  // TODO: per-event location mode (UC-4) — awaiting design
}

// GIS address-suggestion service — a plain address lookup/autocomplete, not
// tied to any policy (unlike CWB, which only searches a policy's known
// properties). Used to prefill the manual-entry form, address mode only.
export interface GisAddressSuggestion {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  state?: string;
  country: string;
  latitude: number;
  longitude: number;
}
