import { Injectable, signal } from '@angular/core';
import teamsData from '../data/teams.json';
import reviewFlagsData from '../data/review-flags.json';
import { ReviewFlag, ScenarioSimulation, Team } from '../../models/team.model';

const TEAMS = teamsData as Team[];

// Same "today-Nd" placeholder claims.json uses, so seeded flags never age.
function resolveDate(value: string): string {
  const m = /^today(?:-(\d+)d)?$/.exec(value);
  if (!m) return value;
  const d = new Date();
  d.setDate(d.getDate() - Number(m[1] ?? 0));
  return d.toISOString().split('T')[0];
}

const REVIEW_FLAGS = (reviewFlagsData as ReviewFlag[]).map(f => ({
  ...f,
  flaggedAt: resolveDate(f.flaggedAt)
}));

// BMPCC-22395 / BMPCC-22666: team structure (who reports to which Claims
// Manager) and the "flagged for review" marks.
// DESIGN DECISION CM-TEAM-1: a team is the manager's direct reports only,
// one manager per handler. Indirect reports (managers of managers) are out
// of scope until the business confirms the org data source.
@Injectable({ providedIn: 'root' })
export class MockTeamService {
  // Dev banner state (ScenarioOverrides.simulate). Reset on every Apply.
  private readonly _simulation = signal<ScenarioSimulation>({});
  readonly simulation = this._simulation.asReadonly();

  setSimulation(sim: ScenarioSimulation | undefined): void {
    this._simulation.set(sim ?? {});
  }

  getTeams(): Team[] {
    return TEAMS;
  }

  teamManagedBy(managerName: string): Team | null {
    return TEAMS.find(t => t.managerName === managerName) ?? null;
  }

  teamOf(memberName: string | null | undefined): Team | null {
    if (!memberName) return null;
    return (
      TEAMS.find(t => t.memberNames.includes(memberName) || t.managerName === memberName) ?? null
    );
  }

  teamByName(name: string | null | undefined): Team | null {
    if (!name) return null;
    return TEAMS.find(t => t.name === name) ?? null;
  }

  teamForGroup(group: string | null | undefined): Team | null {
    if (!group) return null;
    return TEAMS.find(t => t.group === group) ?? null;
  }

  reviewFlags(): ReviewFlag[] {
    return REVIEW_FLAGS;
  }
}
