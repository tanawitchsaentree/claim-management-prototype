import { LocationPickerOutput } from './location-picker.model';

/**
 * What the handler confirms in the "Complete the claim" step of Link policy,
 * before the skeleton claim becomes a regular claim (team decisions of
 * 15 Oct, Confluence 3157631012: description mandatory, cause defaulted to
 * Other, CBI asked if it applies).
 */
export interface CompletionDetails {
  lossDescription: string;
  causeOfLoss: string[];
  specifyOtherCauseOfLoss?: string;
  /** Set only when the handler changed the loss location; absent = kept as entered. */
  location?: LocationPickerOutput;
  cbi?: {
    cbiApplicable: 'yes' | 'no' | null;
    cbiCaseType: string | null;
    cbiThirdPartyName: string;
    cbiThirdPartyIndustry: string;
    cbiLocation: LocationPickerOutput;
  };
}
