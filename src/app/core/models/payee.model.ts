// Make payment, accordion 1 "Payee & beneficiary" and 2 "Payment method".
// The new design's fields aren't specified anywhere we could find; this
// follows the legacy CLAWS "Make Payment" knowledge-base flow (Confluence
// 2762937251): payee -> addressee / bank account -> sanctions -> ultimate
// beneficiary -> email confirmation, and the payment method list.
// ASSUMPTION [MP-1]: field set taken from CLAWS until the BMP Figma is known.

export type PayeeClearance = 'cleared' | 'pending' | 'sanctioned';

export interface PayeeBankAccount {
  accountId: string;
  bankName: string;
  // Masked for display, e.g. "DE89 •••• •••• 3000".
  ibanMasked: string;
  currency: string;
  // GG/CLAWS: an account that's no longer operational is rejected at booking
  // ("Selected account is not operational…", CLAWS AGCLM-8263).
  operational: boolean;
}

export interface PayeeEmail {
  address: string;
  preferred: boolean;
}

export interface Payee {
  payeeId: string;
  name: string;
  role: string;
  address: string;
  email?: string;
  // Contact lines shown on the payee card (`phone` is shown as Mobile).
  phone?: string;
  landline?: string;
  otherAddresses?: string[];
  // Every address a confirmation can go to; the preferred one is listed first.
  emails?: PayeeEmail[];
  clearance: PayeeClearance;
  // GG Name Code from Names Management. Without one GG can't book a payment
  // to this party (GG/CLAWS decision register, gap 4; BMPCC-21261).
  ggNameCode?: string;
  bankAccounts: PayeeBankAccount[];
}

export type PaymentMethod = 'bank-transfer' | 'urgent-wire' | 'cheque' | 'account-entry';

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  // Cheque needs an addressee instead of a bank account.
  needsBankAccount: boolean;
  hint: string;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: 'bank-transfer', label: 'Bank transfer (SEPA)', needsBankAccount: true, hint: 'Usually arrives in 1 business day.' },
  { value: 'urgent-wire', label: 'Urgent wire transfer', needsBankAccount: true, hint: 'Same day if sent before the cut-off time.' },
  { value: 'cheque', label: 'Cheque', needsBankAccount: false, hint: 'Posted to the payee address.' },
  { value: 'account-entry', label: 'Account entry (adjust an earlier payment)', needsBankAccount: false, hint: 'No money moves; corrects coding of a payment already made.' }
];

/** One reserve line paid from in this payment (accordion 3 table). */
export interface PaymentLine {
  reserveId: string;
  amount: number;
}
