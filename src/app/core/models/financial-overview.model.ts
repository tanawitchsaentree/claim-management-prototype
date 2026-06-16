export type FinancialPaymentStatus = 'Pending' | 'Credit' | 'Done' | 'Rejected';
export type FinancialReserveStatus = 'Approved' | 'Pending' | 'Rejected';

export interface FinancialSummary {
  outstandingReserves: number;
  completedPayments:   number;
  pendingPayments:     number;
  recoveries:          number;
  incurred:            number;
}

export interface FinancialDetailRow {
  label:    string;
  gross:    number;
  grossNet: number;
  net:      number;
}

export interface FinancialDetails {
  currency: string;
  ibnr:     number;
  rows:     FinancialDetailRow[];
}

export interface FinancialPayment {
  paymentId:      string;
  reinsuranceId:  string;
  payee:          string;
  handler:        string;
  sectionType:    string;
  status:         FinancialPaymentStatus;
  amount:         number;
  currency:       string;
  paymentDate:    string;
}

export interface FinancialReserve {
  reserveId:       string;
  party:           string;
  damagedItem:     string;
  section:         string;
  reserveSubType:  string;
  status:          FinancialReserveStatus;
  reserveValue:    number;
}

export interface FinancialTransaction {
  transactionId:      string;
  date:               string;
  description:        string;
  indemnityPayment:   number;
  expensePayment:     number;
  totalPayment:       number;
  indemnityRecovery:  number;
  expenseRecovery:    number;
  totalRecovery:      number;
  recoveries:         number;
  totalIncurred:      number;
}

export interface FinancialOverview {
  claimId:      string;
  summary:      FinancialSummary;
  details:      FinancialDetails;
  payments:     FinancialPayment[];
  reserves:     FinancialReserve[];
  transactions: FinancialTransaction[];
}
