import { Claim } from '../../../core/models/claim.model';
import { Task } from '../../../core/models/task.model';
import {
  CaseFlag,
  CaseFlagKind,
  ManagedCase,
  ReviewFlag,
  Team,
  TeamMemberSummary
} from '../../../core/models/team.model';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

// DESIGN DECISION CM-FLAG-1 (BMPCC-22395 open question 1): the three flags
// and their thresholds. Placeholders until the business confirms them; each
// flag says in plain words why it fired, so a changed threshold stays readable.
//   Overdue: the claim has an open task past its due date.
//   High value: loss amount of 250,000 or more (claim currency, no FX).
//   For review: someone marked the claim for the manager (review-flags.json).
export const HIGH_VALUE_THRESHOLD = 250_000;

export const FLAG_LABELS: Record<CaseFlagKind, string> = {
  overdue: 'Overdue',
  'high-value': 'High value',
  review: 'For review'
};

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

const appDate = new AppDatePipe();

function amount(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('en-GB')}`;
}

export function flagsFor(
  claim: Claim,
  tasks: Task[],
  reviews: Map<string, ReviewFlag>,
  today: string
): CaseFlag[] {
  if (claim.status === 'Closed') return [];
  const flags: CaseFlag[] = [];
  const late = tasks
    .filter(t => t.claimId === claim.claimId && t.status !== 'done' && t.dueDate < today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (late.length) {
    flags.push({
      kind: 'overdue',
      label: FLAG_LABELS.overdue,
      reason: `${late.length} task${late.length > 1 ? 's' : ''} late, oldest due ${appDate.transform(late[0].dueDate)}`
    });
  }
  if (claim.lossAmount >= HIGH_VALUE_THRESHOLD) {
    flags.push({
      kind: 'high-value',
      label: FLAG_LABELS['high-value'],
      reason: `${amount(HIGH_VALUE_THRESHOLD, claim.currency)} or more`
    });
  }
  const review = reviews.get(claim.claimId);
  if (review) {
    flags.push({
      kind: 'review',
      label: FLAG_LABELS.review,
      reason: `${review.flaggedBy}: ${review.reason}`
    });
  }
  return flags;
}

/** Cases the manager may see: own claims, direct members' claims, team queue. */
export function buildCases(
  claims: Claim[],
  tasks: Task[],
  reviews: ReviewFlag[],
  team: Team | null,
  managerName: string
): { own: ManagedCase[]; team: ManagedCase[] } {
  const today = new Date().toISOString().split('T')[0];
  const reviewMap = new Map(reviews.map(r => [r.claimId, r]));
  const members = new Set(team?.memberNames ?? []);
  const own: ManagedCase[] = [];
  const teamCases: ManagedCase[] = [];
  for (const c of claims) {
    // Orphan claims still waiting for a policy are worked from FNOL search.
    if (c.skeletonState && c.skeletonState !== 'linked') continue;
    const flags = flagsFor(c, tasks, reviewMap, today);
    if (c.assignee === managerName) {
      own.push({ claim: c, owner: managerName, isQueue: false, flags });
    } else if (c.assignee && members.has(c.assignee)) {
      teamCases.push({ claim: c, owner: c.assignee, isQueue: false, flags });
    } else if (!c.assignee && team?.memberNames.length && c.group === team.group) {
      teamCases.push({ claim: c, owner: 'Team queue', isQueue: true, flags });
    }
  }
  return { own, team: teamCases };
}

export function summarize(
  cases: ManagedCase[],
  team: Team | null,
  missing: Set<string>
): TeamMemberSummary[] {
  const rows: TeamMemberSummary[] = (team?.memberNames ?? []).map(name => ({
    name,
    isQueue: false,
    open: 0,
    flagged: 0,
    overdue: 0,
    highValue: 0,
    missing: missing.has(name)
  }));
  const queue: TeamMemberSummary = {
    name: 'Team queue',
    isQueue: true,
    open: 0,
    flagged: 0,
    overdue: 0,
    highValue: 0,
    missing: false
  };
  for (const mc of cases) {
    const row = mc.isQueue ? queue : rows.find(r => r.name === mc.owner);
    if (!row || row.missing || mc.claim.status !== 'Open') continue;
    row.open++;
    if (mc.flags.length) row.flagged++;
    if (mc.flags.some(f => f.kind === 'overdue')) row.overdue++;
    if (mc.flags.some(f => f.kind === 'high-value')) row.highValue++;
  }
  return team ? [...rows, queue] : rows;
}

export type CaseSortKey = 'claim' | 'owner' | 'priority' | 'updated' | 'amount' | 'flags';

export function sortCases(cases: ManagedCase[], key: CaseSortKey, dir: 'asc' | 'desc'): ManagedCase[] {
  const sign = dir === 'asc' ? 1 : -1;
  const cmp = (a: ManagedCase, b: ManagedCase): number => {
    switch (key) {
      case 'claim':
        return a.claim.claimId.localeCompare(b.claim.claimId);
      case 'owner':
        return a.owner.localeCompare(b.owner);
      case 'priority':
        return (PRIORITY_RANK[a.claim.priority] ?? 9) - (PRIORITY_RANK[b.claim.priority] ?? 9);
      case 'amount':
        return a.claim.lossAmount - b.claim.lossAmount;
      case 'flags':
        return a.flags.length - b.flags.length;
      default:
        return a.claim.dateUpdated.localeCompare(b.claim.dateUpdated);
    }
  };
  return [...cases].sort((a, b) => sign * cmp(a, b));
}
