import { ProviderType } from './provider-assignment.model';

export type HeadsUpSeverity = 'info' | 'warning' | 'critical';
export type NewsType = 'info' | 'warning' | 'urgent';
export type CalendarEventType = 'deadline' | 'meeting' | 'review';

export interface HeadsUpItem {
  id: string;
  claimId: string;
  clientName: string;
  reason: string;
  severity: HeadsUpSeverity;
  status: string;
  lastUpdate: string;
}

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  date: string;
  type: NewsType;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: CalendarEventType;
  claimId?: string;
}

export interface ProviderExpense {
  category: ProviderType;
  label: string;
  amount: number;
  currency: string;
}

export interface FinancialClosurePeriod {
  active: boolean;
  start: string;
  end: string;
  message: string;
}

export interface ReserveMovement {
  id: string;
  claimId: string;
  amountBefore: number;
  amountAfter: number;
  delta: number;
  date: string;
  reason: string;
}

export interface KpiData {
  openClaims: number;
  pendingApprovals: number;
  bigReserveMovements: number;
}

// Loss events — groups of claims arising from one event (e.g. a storm).
// Shown in the Claims portfolio "Loss events" tab.
// (Named *Summary to avoid colliding with LossEvent in loss-information.model.)
export interface LossEventSummary {
  lossEventId: string;
  name: string;
  eventDate: string;
  oe: string;
  lineOfBusiness: string;
  claimCount: number;
  totalReserve: number;
  currency: string;
  status: 'Open' | 'Monitoring' | 'Closed';
}

// Payment approval requests — shown in the Recent approval requests
// "Payments" tab (parallel to reserve approvals).
export interface PaymentApproval {
  requestId: string;
  paymentId: string;
  claimId: string;
  oe: string;
  lineOfBusiness: string;
  paymentType: 'Indemnity' | 'Expense' | 'Provider' | 'Settlement';
  payee: string;
  currency: string;
  amount: number;
  requester: string;
  reviewerEmail?: string;
}
