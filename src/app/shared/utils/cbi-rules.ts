import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  CbiEntityFields,
  LocationPickerOutput,
  LookupOption,
  LossInformationFormValue,
  formatLocationItem
} from '../../core/models';

// Contingent business interruption (CBI) rules, shared by the FNOL Loss
// information step and Edit claim details, so both ask the same questions in
// the same way.

/** 'supplier-*' / 'customer-*' case types are the only ones with a named counterparty. */
export const cbiShowThirdPartyName = (caseType: string | null): boolean =>
  !!caseType && (caseType.startsWith('supplier-') || caseType.startsWith('customer-'));

// ASSUMPTION [CBI-FNOL-3]: only the "-named" case types require the name.
export const cbiThirdPartyRequired = (caseType: string | null): boolean => !!caseType?.endsWith('-named');

export const cbiThirdPartyLabel = (caseType: string | null): string =>
  caseType?.startsWith('customer-') ? 'Customer name' : 'Supplier name';

// BMPCC-18492: the category-specific fields of the CBI functional design
// (Confluence 3163290837, "Category-specific fields" table). Denial of Access
// (all 4) asks for an authority order (Y/N), as the UI/UX alignment page
// (3157631012, row 1) lists; Service Interruption asks for the utility type.
// Loss of Attraction is given a "Trigger event location" there, but flagged
// "may overlap with Originating Loss Location; needs field-level
// reconciliation" and the diagram asks "need use case", so it gets no field
// until that is decided. (Air)Port Blockage is "?" (Open Point 14): no field
// either (DESIGN DECISION CBI-EDIT-3).
export const cbiNeedsAuthorityOrder = (caseType: string | null): boolean =>
  !!caseType?.startsWith('denial-of-access');
export const cbiNeedsUtilityType = (caseType: string | null): boolean =>
  caseType === 'service-interruption';

export interface CbiCaseTypeGroup {
  label: string;
  options: LookupOption[];
}

// DESIGN DECISION CBI-EDIT-2 (BMPCC-18492 open question 2): the 12 case types
// are one dropdown split into the 5 groups the ticket names (Supplier,
// Customer, Denial of Access, Loss of Attraction, Other), not a radio grid or
// a two-step picker. One field, one click to open, and the group headings do
// the scanning work. Each option keeps its full label so the closed field
// still reads on its own ("Supplier, Named", not just "Named"). Groups the
// policy offers nothing in are dropped.
const CBI_GROUPS: { label: string; prefix: string }[] = [
  { label: 'Supplier', prefix: 'supplier-' },
  { label: 'Customer', prefix: 'customer-' },
  { label: 'Denial of Access', prefix: 'denial-of-access' },
  { label: 'Loss of Attraction', prefix: 'loss-of-attraction' }
];
export function cbiCaseTypeGroups(options: LookupOption[]): CbiCaseTypeGroup[] {
  const groups = CBI_GROUPS.map(g => ({
    label: g.label,
    options: options.filter(o => o.value.startsWith(g.prefix))
  }));
  const other = options.filter(o => !CBI_GROUPS.some(g => o.value.startsWith(g.prefix)));
  return [...groups, { label: 'Other', options: other }].filter(g => g.options.length > 0);
}

/** Required-field messages for the two branch-specific fields, for an error summary. */
export function cbiExtraFieldErrors(form: FormGroup): { fieldId: string; message: string }[] {
  const caseType = (form.get('cbiCaseType')?.value as string | null) ?? null;
  const errors: { fieldId: string; message: string }[] = [];
  if (cbiNeedsAuthorityOrder(caseType) && !form.get('cbiAuthorityOrder')?.value) {
    errors.push({ fieldId: 'cbiAuthorityOrder', message: 'Order of an authority: answer required' });
  }
  if (cbiNeedsUtilityType(caseType) && !form.get('cbiUtilityType')?.value) {
    errors.push({ fieldId: 'cbiUtilityType', message: 'Utility type: required' });
  }
  return errors;
}

export const cbiIndustryLabel = (caseType: string | null): string =>
  caseType?.startsWith('customer-') ? 'Customer industry (optional)' : 'Supplier industry (optional)';

/**
 * Adds / clears validators and values on the CBI controls from the current
 * answers. `askQuestion` is whether the CBI question is shown at all.
 */
export function syncCbiControls(
  form: FormGroup,
  cbiLocation: FormControl<LocationPickerOutput>,
  askQuestion: boolean
): void {
  const applicable = form.get('cbiApplicable');
  if (applicable) {
    if (askQuestion) applicable.setValidators([Validators.required]);
    else {
      applicable.clearValidators();
      applicable.setValue(null);
    }
    applicable.updateValueAndValidity({ emitEvent: false });
  }
  const showDetails = askQuestion && form.get('cbiApplicable')?.value === 'yes';
  const caseType = (form.get('cbiCaseType')?.value as string | null) ?? null;

  const caseTypeCtrl = form.get('cbiCaseType');
  if (caseTypeCtrl) {
    if (showDetails) caseTypeCtrl.setValidators([Validators.required]);
    else {
      caseTypeCtrl.clearValidators();
      caseTypeCtrl.setValue(null);
    }
    caseTypeCtrl.updateValueAndValidity({ emitEvent: false });
  }
  const name = form.get('cbiThirdPartyName');
  if (name) {
    if (showDetails && cbiShowThirdPartyName(caseType) && cbiThirdPartyRequired(caseType)) {
      name.setValidators([Validators.required, Validators.maxLength(100)]);
    } else if (showDetails && cbiShowThirdPartyName(caseType)) {
      name.setValidators([Validators.maxLength(100)]);
    } else {
      name.clearValidators();
      name.setValue('');
    }
    name.updateValueAndValidity({ emitEvent: false });
  }
  const industry = form.get('cbiThirdPartyIndustry');
  if (industry) {
    if (showDetails && cbiShowThirdPartyName(caseType)) industry.setValidators([Validators.maxLength(100)]);
    else {
      industry.clearValidators();
      industry.setValue('');
    }
    industry.updateValueAndValidity({ emitEvent: false });
  }
  // BMPCC-18492: branch-specific fields, required while their case type is picked.
  const branchFields: [string, boolean][] = [
    ['cbiAuthorityOrder', showDetails && cbiNeedsAuthorityOrder(caseType)],
    ['cbiUtilityType', showDetails && cbiNeedsUtilityType(caseType)]
  ];
  for (const [key, shown] of branchFields) {
    const ctrl = form.get(key);
    if (!ctrl) continue;
    if (shown) ctrl.setValidators([Validators.required]);
    else {
      ctrl.clearValidators();
      ctrl.setValue(null);
    }
    ctrl.updateValueAndValidity({ emitEvent: false });
  }
  // The location has no Angular validator (it is not a primitive); callers check it by hand.
  // BMPCC-18249 AC04: location only for the supplier/customer case types.
  if (!showDetails || !cbiShowThirdPartyName(caseType)) cbiLocation.setValue({ locations: [] });
}

/** supplier-* / customer-* case types name a counterparty; the others (denial of access, service interruption...) have none. */
export function cbiRelationshipFor(caseType: string): 'supplier' | 'customer' | 'other' {
  if (caseType.startsWith('supplier-')) return 'supplier';
  if (caseType.startsWith('customer-')) return 'customer';
  return 'other';
}

/**
 * The CBI answers to copy onto a Business Interruption entity: at FNOL submit
 * (one section per damage type) and when Edit claim details saves. Fields the
 * case type does not ask for are left out, so the entity panel shows none.
 */
export function cbiEntityFields(v: LossInformationFormValue): CbiEntityFields {
  const caseType = v.cbiCaseType!;
  const loc = v.cbiLocation?.locations?.[0];
  return {
    isContingentBi: true,
    cbiCaseType: caseType,
    thirdPartyName: v.cbiThirdPartyName || undefined,
    thirdPartyRelationship: cbiRelationshipFor(caseType),
    thirdPartyIndustry: v.cbiThirdPartyIndustry || undefined,
    cbiOriginatingLocation: loc ? formatLocationItem(loc) : undefined,
    cbiOriginatingLocationDetail: loc,
    cbiAuthorityOrder: cbiNeedsAuthorityOrder(caseType) ? v.cbiAuthorityOrder ?? undefined : undefined,
    cbiUtilityType: cbiNeedsUtilityType(caseType) ? v.cbiUtilityType ?? undefined : undefined
  };
}

/**
 * Read rows for a CBI entity on Sections (entity detail panel), with the same
 * labels Edit claim details reads them with. Only the rows its case type asks
 * for: third party / industry / location for Supplier and Customer, the
 * authority answer for Denial of Access, the utility for Service Interruption.
 */
export function cbiEntityRows(
  e: CbiEntityFields,
  labels: { caseTypes: LookupOption[]; utilityTypes: LookupOption[] }
): { label: string; value: string }[] {
  const caseType = e.cbiCaseType ?? null;
  const find = (opts: LookupOption[], key?: string) =>
    key ? (opts.find(o => o.value === key)?.label ?? key) : '–';
  const rows = [{ label: 'CBI case type', value: find(labels.caseTypes, e.cbiCaseType) }];
  if (cbiShowThirdPartyName(caseType)) {
    rows.push({ label: cbiThirdPartyLabel(caseType), value: e.thirdPartyName || '–' });
    if (e.thirdPartyIndustry) {
      rows.push({ label: cbiIndustryLabel(caseType).replace(' (optional)', ''), value: e.thirdPartyIndustry });
    }
    rows.push({ label: 'Originating loss location', value: e.cbiOriginatingLocation || '–' });
  }
  if (cbiNeedsAuthorityOrder(caseType)) {
    const answer = e.cbiAuthorityOrder === 'yes' ? 'Yes' : e.cbiAuthorityOrder === 'no' ? 'No' : '–';
    rows.push({ label: 'Access denied by order of an authority', value: answer });
  }
  if (cbiNeedsUtilityType(caseType)) {
    rows.push({ label: 'Utility type', value: find(labels.utilityTypes, e.cbiUtilityType) });
  }
  return rows;
}
