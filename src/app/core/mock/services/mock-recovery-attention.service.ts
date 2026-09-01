import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import {
  RecoveryAttentionItem,
  recoveryPotentialState,
  RECOVERY_STATE_MESSAGE,
} from '../../../core/models/recovery-potential.model';

@Injectable({ providedIn: 'root' })
export class MockRecoveryAttentionService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  /**
   * Open claims whose recovery-potential decision is still outstanding.
   *
   * The Yes/No lives on ClaimOverview, and MockStateService only holds an
   * overview record for claims that were hand-authored in claim-overview.json
   * or already visited (see MockClaimOverviewService.persistAndRespond). A
   * claim with no record has genuinely never had the question answered, so
   * "no overview" resolves to 'unanswered' rather than being skipped — that is
   * exactly the population this dashboard prompt exists to surface.
   */
  getAttentionItems(assignee?: string): Observable<RecoveryAttentionItem[]> {
    const { claims, overviews } = this.stateSvc.state();
    const items: RecoveryAttentionItem[] = [];

    for (const claim of claims) {
      if (claim.status === 'Closed') continue;
      if (assignee && claim.assignee !== assignee) continue;

      const overview = overviews[claim.claimId];
      const state = recoveryPotentialState(overview ?? {});
      if (state !== 'unanswered' && state !== 'yes-pending') continue;

      items.push({
        claimId: claim.claimId,
        clientName: claim.clientName,
        state,
        reason: RECOVERY_STATE_MESSAGE[state],
      });
    }

    // Yes-but-not-set-up first: the handler already committed to a recovery,
    // so the money is identified and only the case is missing.
    items.sort((a, b) => Number(a.state === 'unanswered') - Number(b.state === 'unanswered'));
    return this.list(items);
  }
}
