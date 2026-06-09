export type HeadsUpSeverity = 'info' | 'warning' | 'critical';
export type NewsType = 'info' | 'warning' | 'urgent';
export type CalendarEventType = 'deadline' | 'meeting' | 'review';
export type ProviderType = 'adjuster' | 'legal' | 'expert' | 'other';

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
