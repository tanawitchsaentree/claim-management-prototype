import { FormControl, FormGroup, Validators } from '@angular/forms';
import { LocationPickerOutput } from '../../core/models';

// Contingent business interruption (CBI) rules, shared by the FNOL Loss
// information step and the Link policy "Complete the claim" step, so both ask
// the same questions in the same way.

/** 'supplier-*' / 'customer-*' case types are the only ones with a named counterparty. */
export const cbiShowThirdPartyName = (caseType: string | null): boolean =>
  !!caseType && (caseType.startsWith('supplier-') || caseType.startsWith('customer-'));

// ASSUMPTION [CBI-FNOL-3]: only the "-named" case types require the name.
export const cbiThirdPartyRequired = (caseType: string | null): boolean => !!caseType?.endsWith('-named');

export const cbiThirdPartyLabel = (caseType: string | null): string =>
  caseType?.startsWith('customer-') ? 'Customer name' : 'Supplier name';

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
  // The location has no Angular validator (it is not a primitive); callers check it by hand.
  if (!showDetails) cbiLocation.setValue({ locations: [] });
}
