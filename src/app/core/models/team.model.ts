import { Claim } from './claim.model';

// BMPCC-22395 / BMPCC-22666: who belongs to which team, and the flags a
// Claims Manager uses to spot claims that need them.

export interface Team {
  teamId: string;
  name: string;
  // Claims with no handler but this group sit in the team's queue.
  group: string;
  managerName: string;
  // Direct team members only (DESIGN DECISION CM-TEAM-1).
  memberNames: string[];
}

export type CaseFlagKind = 'overdue' | 'high-value' | 'review';

export interface CaseFlag {
  kind: CaseFlagKind;
  label: string;
  // Plain sentence shown next to the flag: why it is flagged.
  reason: string;
}

// A claim someone marked for the manager to look at.
export interface ReviewFlag {
  claimId: string;
  reason: string;
  flaggedBy: string;
  flaggedAt: string;
}

export interface ManagedCase {
  claim: Claim;
  // Handler name, or the team queue label when nobody has it yet.
  owner: string;
  isQueue: boolean;
  flags: CaseFlag[];
}

export interface TeamMemberSummary {
  name: string;
  isQueue: boolean;
  open: number;
  flagged: number;
  overdue: number;
  highValue: number;
  // True when this member's cases could not be loaded (partial data state).
  missing: boolean;
}

// Dev banner only: puts the Claims Manager dashboard into a state that is
// hard to reach with real data.
export type ManagerDashboardSimulation =
  | 'loading'
  | 'error'
  | 'stale'
  | 'partial'
  | 'no-team'
  | 'no-cases'
  | 'no-permission';

// Dev banner only: puts the reassign dialog into its loading / error / empty
// states, or makes the save fail.
export type AssignmentSimulation = 'loading' | 'error' | 'empty' | 'save-fails';

export interface ScenarioSimulation {
  managerDashboard?: ManagerDashboardSimulation;
  assignment?: AssignmentSimulation;
}

// Who a claim can go to.
export interface AssignmentTarget {
  kind: 'handler' | 'team';
  name: string;
  // Team the handler belongs to, or the team's manager, for the picker line.
  detail: string;
  // Set when the person can't take new claims right now.
  unavailableReason?: string;
}

export interface AssignmentCheck {
  allowed: boolean;
  // Plain sentence for the handler when not allowed.
  reason?: string;
}
