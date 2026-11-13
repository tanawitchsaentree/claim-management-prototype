import { FormControl } from '@angular/forms';
import { LossInformation } from '../../../core/models/loss-information.model';
import { LocationPickerOutput, LookupOption, formatLocationItem } from '../../../core/models';
import { cbiThirdPartyLabel } from '../../../shared/utils/cbi-rules';

// BMPCC-18492: CBI on Edit claim details. Kept out of
// edit-loss-information.component.ts (already far over the 300-line limit):
// the controls, the prefill and the diff rows are plain data and functions.

/** The CBI controls, added to the page's own FormGroup next to the loss information. */
export function cbiEditControls() {
  return {
    cbiApplicable: new FormControl<'yes' | 'no' | null>(null),
    cbiCaseType: new FormControl<string | null>(null),
    cbiThirdPartyName: new FormControl<string>(''),
    cbiThirdPartyIndustry: new FormControl<string>(''),
    cbiAuthorityOrder: new FormControl<'yes' | 'no' | null>(null),
    cbiUtilityType: new FormControl<string | null>(null),
    cbiLocation: new FormControl<LocationPickerOutput>({ locations: [] })
  };
}

export const CBI_CONTROL_KEYS = Object.keys(cbiEditControls());

/** The stored record's CBI answers, in the shape the controls take. */
export function cbiPatchFrom(li: LossInformation | null) {
  return {
    cbiApplicable: li?.cbiApplicable ?? null,
    cbiCaseType: li?.cbiCaseType ?? null,
    cbiThirdPartyName: li?.cbiThirdPartyName ?? '',
    cbiThirdPartyIndustry: li?.cbiThirdPartyIndustry ?? '',
    cbiAuthorityOrder: li?.cbiAuthorityOrder ?? null,
    cbiUtilityType: li?.cbiUtilityType ?? null,
    cbiLocation: li?.cbiLocation ?? { locations: [] }
  };
}

/** The CBI values a record or a form holds; both shapes carry the same optional keys. */
export type CbiValues = Partial<ReturnType<typeof cbiPatchFrom>>;

export interface CbiLabelSources {
  caseTypes: LookupOption[];
  utilityTypes: LookupOption[];
}

/** One label + display value per CBI answer, in the order the page reads them. */
export function cbiDisplayRows(v: CbiValues, labels: CbiLabelSources): { label: string; value: string }[] {
  const yesNo = (a: string | null | undefined) => (a === 'yes' ? 'Yes' : a === 'no' ? 'No' : '');
  const find = (opts: LookupOption[], key: string | null | undefined) =>
    key ? (opts.find(o => o.value === key)?.label ?? key) : '';
  const loc = v.cbiLocation?.locations?.[0];
  return [
    { label: 'Contingent business interruption', value: yesNo(v.cbiApplicable) },
    { label: 'CBI case type', value: find(labels.caseTypes, v.cbiCaseType) },
    // The diff keys on one stable label; the read view swaps in Supplier/Customer.
    { label: 'CBI third party', value: v.cbiThirdPartyName ?? '' },
    { label: 'CBI third-party industry', value: v.cbiThirdPartyIndustry ?? '' },
    { label: 'CBI originating location', value: loc ? formatLocationItem(loc) : '' },
    { label: 'CBI order of an authority', value: yesNo(v.cbiAuthorityOrder) },
    { label: 'CBI utility type', value: find(labels.utilityTypes, v.cbiUtilityType) }
  ];
}

/** The originating location has no Angular validator (FNOL checks it by hand too). */
export function cbiLocationMissing(v: CbiValues, shown: boolean): boolean {
  const caseType = v.cbiCaseType ?? '';
  const needsLocation = caseType.startsWith('supplier-') || caseType.startsWith('customer-');
  return shown && v.cbiApplicable === 'yes' && needsLocation && !v.cbiLocation?.locations?.length;
}

/** Diff labels -> the read/edit group they belong to (all one card). */
export const CBI_LABEL_TO_FIELD_KEY: Record<string, string> = Object.fromEntries(
  cbiDisplayRows({}, { caseTypes: [], utilityTypes: [] }).map(r => [r.label, 'cbi'])
);

/** Friendlier read-view label for the third-party rows, once the case type says who it is. */
export function cbiReadLabel(label: string, caseType: string | null | undefined): string {
  const who = cbiThirdPartyLabel(caseType ?? null).replace(' name', '');
  if (label === 'CBI third party') return cbiThirdPartyLabel(caseType ?? null);
  if (label === 'CBI third-party industry') return `${who} industry`;
  if (label === 'CBI originating location') return 'Originating loss location';
  if (label === 'CBI order of an authority') return 'Access denied by order of an authority';
  if (label === 'CBI utility type') return 'Utility type';
  if (label === 'Contingent business interruption') return 'Caused by CBI';
  return label;
}
