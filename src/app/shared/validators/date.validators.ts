import { AbstractControl, ValidationErrors } from '@angular/forms';

export function futureDateValidator(control: AbstractControl): ValidationErrors | null {
  const val = control.value as string | null;
  if (val && val > new Date().toISOString().split('T')[0]) {
    return { futureDate: true };
  }
  return null;
}

export function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const occurrence   = group.get('dateOfOccurrence')?.value as string | null;
  const notification = group.get('dateOfNotification')?.value as string | null;
  if (occurrence && notification && occurrence > notification) {
    return { dateOrder: true };
  }
  return null;
}
