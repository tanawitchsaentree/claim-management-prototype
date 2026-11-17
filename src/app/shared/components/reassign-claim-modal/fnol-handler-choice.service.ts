import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockTeamService } from '../../../core/mock/services/mock-team.service';
import { MockNotificationService } from '../../../core/mock/services/mock-notification.service';
import { FnolStateService } from '../../../core/services/fnol-state.service';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { AssignmentTarget } from '../../../core/models/team.model';
import { Claim } from '../../../core/models/claim.model';

// BMPCC-22666 AC01: the handler picked on the FNOL Summary step. Held in
// FnolStateService.handlerChoice for the whole notification (Back and forth
// keeps it, a new notification clears it) and written onto every claim Submit
// creates.
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

  private readonly fnolState = inject(FnolStateService);

  readonly choice = computed<AssignmentTarget | null>(
    () => this.fnolState.handlerChoice()?.target ?? null
  );
  readonly reason = computed(() => this.fnolState.handlerChoice()?.reason);

  /** How the chosen handler reads everywhere: "Lena Zorn", "Property claims team queue". */
  readonly label = computed(() => {
    const c = this.choice();
    if (!c) return `${this.auth.user().name} (you)`;
    return c.kind === 'team' ? `${c.name} queue` : c.name;
  });

  set(target: AssignmentTarget | null, reason?: string): void {
    this.fnolState.handlerChoice.set(
      target ? { target, reason: reason?.trim() || undefined } : null
    );
  }

  /** The claim record with the chosen (or default) handler on it. */
  applyTo(claim: Claim): Claim {
    const c = this.choice();
    if (!c) return { ...claim, assignee: this.auth.user().name };
    const team = c.kind === 'team' ? this.teamSvc.teamByName(c.name) : null;
    return { ...claim, assignee: team ? null : c.name, group: team ? team.group : claim.group };
  }

  /**
   * After Submit, once per created claim: show the team name on the overview,
   * log the handler and the reason in the claim's activity log (same entry as
   * MockAssignmentService.reassign, mock-assignment.service.ts:176-186) and
   * tell the new handler. The choice is kept, so every claim of a multi-policy
   * notification gets it and Summary can still say who has the claim.
   */
  announce(claimId: string): void {
    const c = this.choice();
    if (!c) return;
    const actor = this.auth.user().name;
    const team = c.kind === 'team' ? this.teamSvc.teamByName(c.name) : null;
    const label = team ? team.name : c.name;
    if (team)
      this.stateSvc.patchOverview(claimId, { assignedHandler: team.name, handler: team.name });
    const reason = this.reason();
    const activity: ClaimActivity = {
      id: `act-assign-${claimId}-${Date.now()}`,
      claimId,
      user: actor,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Assigned Claim handler',
      valueOld: actor,
      valueNew: reason ? `${label}: ${reason}` : label
    };
    this.stateSvc.patchActivities(existing => [activity, ...existing]);
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
