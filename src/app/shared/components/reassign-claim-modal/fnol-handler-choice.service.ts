import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockTeamService } from '../../../core/mock/services/mock-team.service';
import { MockNotificationService } from '../../../core/mock/services/mock-notification.service';
import { AssignmentTarget } from '../../../core/models/team.model';
import { Claim } from '../../../core/models/claim.model';

// BMPCC-22666 AC01: the handler picked on the FNOL Summary step, held until
// Submit writes the claim.
// DESIGN DECISION RA-FNOL-1: by default a new claim goes to the handler who
// registers it (rule-based routing is a later epic). Picking someone else
// here needs no confirm: nothing is saved before Submit, and Submit is the
// commit. The new handler (or the team's manager) is notified on Submit.
@Injectable({ providedIn: 'root' })
export class FnolHandlerChoiceService {
  private readonly auth = inject(AuthService);
  private readonly stateSvc = inject(MockStateService);
  private readonly teamSvc = inject(MockTeamService);
  private readonly notifySvc = inject(MockNotificationService);

  readonly choice = signal<AssignmentTarget | null>(null);
  readonly reason = signal<string | undefined>(undefined);

  set(target: AssignmentTarget | null, reason?: string): void {
    this.choice.set(target);
    this.reason.set(reason);
  }

  /** The claim record with the chosen (or default) handler on it. */
  applyTo(claim: Claim): Claim {
    const c = this.choice();
    if (!c) return { ...claim, assignee: this.auth.user().name };
    const team = c.kind === 'team' ? this.teamSvc.teamByName(c.name) : null;
    return { ...claim, assignee: team ? null : c.name, group: team ? team.group : claim.group };
  }

  /** After Submit: show the team name on the overview and tell the new handler. */
  announce(claimId: string): void {
    const c = this.choice();
    this.set(null);
    if (!c) return;
    const actor = this.auth.user().name;
    const team = c.kind === 'team' ? this.teamSvc.teamByName(c.name) : null;
    if (team) this.stateSvc.patchOverview(claimId, { assignedHandler: team.name, handler: team.name });
    const recipient = team ? team.managerName : c.name;
    if (recipient === actor) return;
    this.notifySvc.push({
      id: `assigned-${claimId}`,
      claimId,
      tone: 'action',
      recipient,
      title: `${claimId} was assigned to ${team ? `the ${team.name} queue` : 'you'} by ${actor} at registration`,
      link: ['/claims', claimId, 'overview']
    });
  }
}
