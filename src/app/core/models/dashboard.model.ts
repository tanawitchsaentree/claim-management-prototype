import { Claim } from './claim.model';
import { Task } from './task.model';
import { UrgentApproval } from './approval.model';

export interface ClaimStatBar {
  label: string;
  value: number;
  color: string;
}

export interface ClaimStats {
  total: number;
  opened: number;
  closed: number;
}

export interface QuickLink {
  label: string;
  url?: string;
}

export interface DashboardVM {
  loading: boolean;
  error: string | null;
  tasks: Task[];
  recentClaims: Claim[];
  stats: ClaimStats;
  quickLinks: QuickLink[];
  portfolioTab: 'claims' | 'loss-events';
  urgentApprovals: UrgentApproval[];
}
