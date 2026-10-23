import { FormControl, FormGroup } from '@angular/forms';
import { Payee } from '../../../core/models/payee.model';

// The Make payment form: one place for its fields and their defaults.
export function createPaymentForm() {
  return new FormGroup({
    payeeId: new FormControl<string | null>(null),
    beneficiary: new FormControl<'same' | 'different'>('same', { nonNullable: true }),
    beneficiaryName: new FormControl('', { nonNullable: true }),
    confirmEmail: new FormControl(false, { nonNullable: true }),
    confirmChannel: new FormControl<'email' | 'letter'>('email', { nonNullable: true }),
    emailAddress: new FormControl('', { nonNullable: true }),
    // Letter confirmation: a listed address, or a different one typed in.
    letterAddress: new FormControl('', { nonNullable: true }),
    letterDifferent: new FormControl(false, { nonNullable: true }),
    letterCustom: new FormControl('', { nonNullable: true }),
    method: new FormControl<string | null>('bank-transfer'),
    bankAccountId: new FormControl<string | null>(null),
    paymentDate: new FormControl<Date | null>(new Date()),
    reference: new FormControl('', { nonNullable: true }),
    currency: new FormControl('EUR', { nonNullable: true }),
    vat: new FormControl(false, { nonNullable: true }),
    coInsurance: new FormControl<'allianz' | 'market' | null>(null)
  });
}

/** A fresh form for this payee and currency: today, bank transfer, VAT off, same beneficiary. */
export function defaultValues(payee: Payee | undefined, currency: string) {
  return {
    payeeId: payee?.payeeId ?? null,
    beneficiary: 'same' as const,
    beneficiaryName: '',
    confirmEmail: false,
    confirmChannel: 'email' as const,
    emailAddress: payee?.email ?? '',
    letterAddress: payee?.address ?? '',
    letterDifferent: false,
    letterCustom: '',
    method: 'bank-transfer',
    bankAccountId: null,
    paymentDate: new Date(),
    reference: '',
    currency,
    vat: false,
    coInsurance: null
  };
}
