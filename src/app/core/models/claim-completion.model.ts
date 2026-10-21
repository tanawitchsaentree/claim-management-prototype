import { LocationPickerOutput } from './location-picker.model';

/**
 * What the handler confirms in the "Complete the claim" step of Link policy,
 * before the skeleton claim becomes a regular claim (team decisions of
 * 15 Oct, Confluence 3157631012: description mandatory, cause defaulted to
 * Other, CBI asked if it applies).
 */
/** One section to create from the coverages the handler ticked. */
export interface SectionPlan {
  damageType: string;
  entityNames: string[];
}

/** An optional first reserve for one of those sections (matched by position in `sections`). */
export interface ReservePlan {
  sectionIndex: number;
  reserveType: string;
  reserveSubType: string;
  amount: number;
}

export interface CompletionDetails {
  lossDescription: string;
  causeOfLoss: string[];
  specifyOtherCauseOfLoss?: string;
  /** Set only when the handler changed the loss location; absent = kept as entered. */
  location?: LocationPickerOutput;
  /** Sections to build from the ticked coverages; absent/empty = one from the cause. */
  sections?: SectionPlan[];
  /** Reserves set for those sections; absent = none (the 'Set up reserves' task stays). */
  reserves?: ReservePlan[];
  cbi?: {
    cbiApplicable: 'yes' | 'no' | null;
    cbiCaseType: string | null;
    cbiThirdPartyName: string;
    cbiThirdPartyIndustry: string;
    cbiLocation: LocationPickerOutput;
  };
}

/** What the toast says after Link policy: the sections made and whether a reserves task is waiting. */
export function linkedMessage(policyNumber: string, r: { sections: number; reserveTask: boolean }): string {
  const made = r.sections === 1 ? '1 section' : `${r.sections} sections`;
  return (
    `Policy ${policyNumber} linked, ${made} on the claim.` +
    (r.reserveTask ? ' A task to set up reserves was added to your task list.' : ' Reserves are set.')
  );
}
