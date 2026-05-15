import { ValidationErrors } from '@angular/forms';

export const ERROR_MESSAGES: Record<string, (params?: Record<string, unknown>) => string> = {
  required:                       () => 'This field is required',
  futureDate:                     () => "Date can't be in the future",
  dateOrder:                      () => 'Notification date must be on or after occurrence date',
  atLeastOne:                     () => 'Select at least one option',
  maxlength: (p) => `Maximum ${(p as { requiredLength: number }).requiredLength} characters`,
  min:       (p) => `Minimum value: ${(p as { min: number }).min}`,
  max:       (p) => `Maximum value: ${(p as { max: number }).max}`,
};

export function getErrorMessage(errors: ValidationErrors | null): string | null {
  if (!errors) return null;
  const firstKey = Object.keys(errors)[0];
  const fn = ERROR_MESSAGES[firstKey];
  return fn ? fn(errors[firstKey] as Record<string, unknown>) : 'Invalid value';
}
