import { Bookable } from './gg-booking.model';
import { PaymentLine, PaymentMethod } from './payee.model';

// Draft / Requires amendment / Approved added for the GG booking journey
// (BMPCC-19169): approval states first, then the booking state takes over.
export type FinancialPaymentStatus =
  | 'Draft'
  | 'Pending'
  | 'Requires amendment'
  | 'Approved'
  | 'Credit'
  | 'Done'
  | 'Rejected';
export type FinancialReserveStatus = 'Approved' | 'Pending' | 'Rejected';
export type FinancialRecoveryStatus = 'Approved' | 'Pending' | 'Rejected';

export interface FinancialSummary {
  outstandingReserves: number;
  completedPayments: number;
  pendingPayments: number;
  recoveries: number;
  incurred: number;
}

export interface FinancialDetailRow {
  label: string;
  gross: number;
  grossNet: number;
  net: number;
}

export interface FinancialDetails {
  currency: string;
  ibnr: number;
  rows: FinancialDetailRow[];
}

export interface FinancialPayment extends Bookable {
  paymentId: string;
  reinsuranceId: string;
  payee: string;
  handler: string;
  sectionType: string;
  status: FinancialPaymentStatus;
  amount: number;
  currency: string;
  paymentDate: string;
  // The section it belongs to. Section level is a filter on the claim-level list by this id.
  sectionId?: string;
  // Make payment modal (multi-line). Optional: older payments have none.
  lines?: PaymentLine[];
  payeeId?: string;
  bankAccountId?: string;
  method?: PaymentMethod;
  vatApplicable?: boolean;
  coInsurance?: 'allianz' | 'market';
}

export interface FinancialReserve extends Bookable {
  reserveId: string;
  party: string;
  damagedItem: string;
  section: string;
  // The section this reserve belongs to; the Section-level view is a filter on
  // this, not a second list. Absent = not attached to a section.
  sectionId?: string;
  // Short label shown after the party in the Section column ("PD", "BI", ...).
  sectionCode?: string;
  reserveType: string;
  reserveSubType: string;
  status: FinancialReserveStatus;
  reserveValue: number;
  currency: string;
  // Email of whoever set / last changed the reserve. The approver has to be
  // someone else; also what the Approvals page shows as Requester.
  requestedBy?: string;
}

export interface FinancialRecovery extends Bookable {
  recoveryId: string;
  // The section it belongs to (Section level filters the claim-level list by this).
  sectionId?: string;
  bookingId: string;
  reinsuranceId: string;
  party: string;
  section: string;
  recoveryType: string;
  status: FinancialRecoveryStatus;
  amount: number;
  currency: string;
  recoveryDate: string;
  bookingDate: string;
}

export interface ReserveHistoryEntry {
  date: string;
  amount: number;
  reason: string;
  user: string;
}

export interface FinancialReserveWithHistory extends FinancialReserve {
  history?: ReserveHistoryEntry[];
}

export interface FinancialTransaction {
  transactionId: string;
  date: string;
  description: string;
  indemnityPayment: number;
  expensePayment: number;
  totalPayment: number;
  indemnityRecovery: number;
  expenseRecovery: number;
  totalRecovery: number;
  recoveries: number;
  totalIncurred: number;
}

export interface FinancialOverview {
  claimId: string;
  summary: FinancialSummary;
  details: FinancialDetails;
  payments: FinancialPayment[];
  reserves: FinancialReserve[];
  recoveries: FinancialRecovery[];
  transactions: FinancialTransaction[];
  sections: FinancialSection[];
}

// ─── Section level ────────────────────────────────────────────────────────────

export interface FinancialSectionSummaryRow {
  movementType: string;
  outstandingReserves: number;
  completedPayments: number;
  pendingPayments: number;
  recoveries: number;
  incurred: number;
}

export interface FinancialSection {
  sectionId: string;
  sectionName: string;
  // Short label for the Reserves table's Section column ("PD", "BI", ...).
  code?: string;
  currency: string;
  exchangeRate: number;
  baseCurrency: string;
  summaryRows: FinancialSectionSummaryRow[];
  // Section level filters the claim-level payments / reserves / recoveries by sectionId.
  // These three lists are no longer filled; they stay so older state still loads.
  payments: FinancialPayment[];
  reserves: FinancialReserve[];
  recoveries: FinancialRecovery[];
}
