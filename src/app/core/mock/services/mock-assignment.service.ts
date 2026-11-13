import { Injectable, inject } from '@angular/core';
import { Observable, NEVER, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { MockStateService } from '../state/mock-state.service';
import { MockTeamService } from './mock-team.service';
import { MockNotificationService } from './mock-notification.service';
import { MockUserDirectoryService } from './mock-user-directory.service';
import { User } from '../../services/auth';
import { AssignmentCheck, AssignmentTarget, Team } from '../../models/team.model';
import { ClaimActivity } from '../../models/claim-overview.model';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

// DESIGN DECISION RA-AUTH-1 (BMPCC-22666 AC03): handling authority is a loss
// amount ceiling. Claims Handlers handle up to 500,000; Claims Managers and
// KCM have no ceiling. Amounts are compared as entered, without currency
// conversion (the prototype has no FX rates).
export const HANDLER_AUTHORITY_LIMIT = 500_000;

/** The claim facts the assignment rules need. */
export interface AssignableClaim {
  claimId: string;
  // Person who has it, a team name (team queue) or null.
  owner: string | null;
  group?: string | null;
  status: string;
  lossAmount: number;
  currency: string;
}

export interface ReassignResult {
  moved: { claimId: string; from: string }[];
  targetLabel: string;
}

@Injectable({ providedIn: 'root' })
export class MockAssignmentService {
  private readonly stateSvc = inject(MockStateService);
  private readonly teamSvc = inject(MockTeamService);
  private readonly notifySvc = inject(MockNotificationService);
  private readonly directory = inject(MockUserDirectoryService);
  private readonly appDate = new AppDatePipe();

  /** Team that currently holds the claim: the owner's team, or the queue's team. */
  owningTeam(c: AssignableClaim): Team | null {
    const byName = this.teamSvc.teamByName(c.owner);
    if (byName) return byName;
    if (!c.owner || c.owner === 'Unassigned') return this.teamSvc.teamForGroup(c.group);
    return this.teamSvc.teamOf(c.owner);
  }

  isQueue(c: AssignableClaim): boolean {
    return !c.owner || c.owner === 'Unassigned' || !!this.teamSvc.teamByName(c.owner);
  }

  private authorityLimit(user: User): number {
    return user.dashboardRole === 'claims-handler' ? HANDLER_AUTHORITY_LIMIT : Infinity;
  }

  // DESIGN DECISION RA-AUTH-2: you can reassign a claim you own; a Claims
  // Manager can also reassign anything their team holds; KCM anything open.
  canReassign(c: AssignableClaim, user: User): AssignmentCheck {
    if (c.status === 'Closed') {
      return { allowed: false, reason: 'Closed claims cannot be reassigned. Reopen it first.' };
    }
    if (c.owner === user.name || user.dashboardRole === 'kcm') return { allowed: true };
    const team = this.owningTeam(c);
    if (user.dashboardRole === 'claims-manager' && team?.managerName === user.name) {
      return { allowed: true };
    }
    return { allowed: false };
  }

  // DESIGN DECISION RA-AUTH-3: a handler can take a claim held by their own
  // team (a colleague or the team queue) if it is within their authority.
  // Claims of another team stay with that team: its manager moves them.
  canTake(c: AssignableClaim, user: User): AssignmentCheck {
    if (c.status === 'Closed') {
      return { allowed: false, reason: 'Closed claims cannot be taken over. Reopen it first.' };
    }
    if (c.owner === user.name) return { allowed: false, reason: 'This claim is already yours.' };
    if (user.dashboardRole === 'kcm') return { allowed: true };
    const team = this.owningTeam(c);
    const myTeam = this.teamSvc.teamOf(user.name);
    if (!team) {
      return {
        allowed: false,
        reason: 'Not held by your team. Ask its handler to reassign it to you.'
      };
    }
    if (!myTeam || myTeam.teamId !== team.teamId) {
      return {
        allowed: false,
        reason: `Held by the ${team.name}. Ask ${team.managerName} (team manager) to move it to you.`
      };
    }
    if (c.lossAmount > this.authorityLimit(user)) {
      return {
        allowed: false,
        reason: `Above your handling authority (up to ${c.currency} 500,000). Ask ${team.managerName} (team manager) to assign it.`
      };
    }
    return { allowed: true };
  }

  /**
   * Handlers and team queues a claim can go to. `maxAmount` is the largest
   * loss amount among the claims being moved, for the authority check.
   */
  targets(excludeOwner: string | null, maxAmount: number): Observable<AssignmentTarget[]> {
    const sim = this.teamSvc.simulation().assignment;
    if (sim === 'loading') return NEVER;
    if (sim === 'error') {
      return throwError(() => new Error('directory unavailable')).pipe(delay(400));
    }
    if (sim === 'empty') return of([]).pipe(delay(300));
    return this.directory.getAll().pipe(
      map(users => {
        const out: AssignmentTarget[] = [];
        for (const u of users) {
          const team = this.teamSvc.teamOf(u.name);
          if (!team || u.name === excludeOwner) continue;
          const isManager = team.managerName === u.name;
          let unavailableReason: string | undefined;
          if (u.outOfOfficeUntil) {
            unavailableReason = `Out of office until ${this.appDate.transform(u.outOfOfficeUntil)}`;
          } else if (!isManager && maxAmount > HANDLER_AUTHORITY_LIMIT) {
            unavailableReason = 'Above their handling authority (up to 500,000)';
          }
          out.push({
            kind: 'handler',
            name: u.name,
            detail: isManager ? `${team.name} manager` : team.name,
            unavailableReason
          });
        }
        for (const t of this.teamSvc.getTeams()) {
          if (t.name === excludeOwner) continue;
          out.push({ kind: 'team', name: t.name, detail: `Team queue, managed by ${t.managerName}` });
        }
        return out;
      }),
      delay(300)
    );
  }

  /** Moves the claims, writes the activity log and tells both handlers. */
  reassign(
    claims: AssignableClaim[],
    target: AssignmentTarget,
    actor: string,
    reason?: string
  ): Observable<ReassignResult> {
    if (this.teamSvc.simulation().assignment === 'save-fails') {
      return throwError(() => new Error('assignment service unavailable')).pipe(delay(500));
    }
    const team = target.kind === 'team' ? this.teamSvc.teamByName(target.name) : null;
    const targetLabel = target.name;
    const ids = new Set(claims.map(c => c.claimId));
    const today = new Date().toISOString().split('T')[0];
    this.stateSvc.patchClaims(list =>
      list.map(c =>
        ids.has(c.claimId)
          ? {
              ...c,
              assignee: team ? null : target.name,
              group: team ? team.group : c.group,
              dateUpdated: today
            }
          : c
      )
    );
    const now = new Date().toISOString();
    const activities: ClaimActivity[] = [];
    const moved = claims.map(c => {
      const from = this.ownerLabel(c);
      this.stateSvc.patchOverview(c.claimId, { assignedHandler: targetLabel, handler: targetLabel });
      activities.push({
        id: `act-assign-${c.claimId}-${Date.now()}`,
        claimId: c.claimId,
        user: actor,
        timestamp: now,
        objectType: 'Claim',
        attribute: 'Assigned Claim handler',
        valueOld: from,
        valueNew: reason ? `${targetLabel}: ${reason}` : targetLabel
      });
      return { claimId: c.claimId, from };
    });
    this.stateSvc.patchActivities(existing => [...activities, ...existing]);
    this.notify(moved, target, team, actor);
    return of({ moved, targetLabel }).pipe(delay(400));
  }

  ownerLabel(c: AssignableClaim): string {
    if (c.owner && c.owner !== 'Unassigned') return c.owner;
    const team = this.owningTeam(c);
    return team ? team.name : 'Unassigned';
  }

  // AC04: the previous handler hears the claim moved away, the new one that it
  // arrived. A team target notifies its manager. One line per person, so a
  // bulk move of 12 claims is one notification, not 12.
  private notify(
    moved: { claimId: string; from: string }[],
    target: AssignmentTarget,
    team: Team | null,
    actor: string
  ): void {
    const stamp = Date.now();
    const newRecipient = team ? team.managerName : target.name;
    if (newRecipient !== actor) {
      const one = moved.length === 1 ? moved[0].claimId : null;
      const where = team ? `the ${team.name} queue` : 'you';
      this.notifySvc.push({
        id: `assigned-${newRecipient}-${stamp}`,
        claimId: one ?? moved[0].claimId,
        tone: 'action',
        recipient: newRecipient,
        title: one
          ? `${one} was assigned to ${where} by ${actor}`
          : `${moved.length} claims were assigned to ${where} by ${actor}`,
        link: one ? ['/claims', one, 'overview'] : ['/claims'],
        queryParams: one || team ? undefined : { assignee: 'me' }
      });
    }
    const byFrom = new Map<string, string[]>();
    for (const m of moved) {
      if (m.from === actor || m.from === 'Unassigned' || this.teamSvc.teamByName(m.from)) continue;
      byFrom.set(m.from, [...(byFrom.get(m.from) ?? []), m.claimId]);
    }
    for (const [from, claimIds] of byFrom) {
      this.notifySvc.push({
        id: `moved-${from}-${stamp}`,
        claimId: claimIds[0],
        tone: 'info',
        recipient: from,
        title:
          claimIds.length === 1
            ? `${claimIds[0]} was moved to ${target.name} by ${actor}`
            : `${claimIds.length} of your claims were moved to ${target.name} by ${actor}`,
        link: ['/claims', claimIds[0], 'overview']
      });
    }
  }
}
