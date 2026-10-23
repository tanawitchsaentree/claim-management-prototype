import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RejectionApproval } from '../models/approval.model';
import { ClaimActivity } from '../models/claim-overview.model';
import { MockRejectionApprovalService } from '../mock/services/mock-rejection-approval.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { ClaimClosureService } from './claim-closure.service';

// BMPCC-17630 — the second-level approver's two decisions on a coverage-related
// rejection. Shared by the Approvals > Claims table and the request detail page.
@Injectable({ providedIn: 'root' })
export class RejectionApprovalService {
  private readonly rejectionSvc = inject(MockRejectionApprovalService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly closureSvc = inject(ClaimClosureService);
  private readonly stateSvc = inject(MockStateService);

  /** Closes the claim as Claim Rejected, with the approver's reason. Throws if the closure fails. */
  async approve(item: RejectionApproval, reason: string): Promise<void> {
    if (this.rejectionSvc.isSeeded(item.claimId)) {
      this.rejectionSvc.decideSeeded(item.claimId);
      return;
    }
    await firstValueFrom(
      this.closureSvc.closeClaim(item.claimId, {
        reason: 'Claim Rejected',
        retentionType: 'default',
        confirmedBy: { userId: 'usr-current', name: item.requester }
      })
    );
    this.stateSvc.patchOverview(item.claimId, {
      rejectionRequestedAt: undefined,
      rejectionRequestedBy: undefined,
      rejectionType: undefined,
      rejectionReason: undefined
    });
    this.logDecision(item, 'Approved', reason);
  }

  /** Closes the request with the approver's reason; the claim was Open all along and stays Open. */
  decline(item: RejectionApproval, reason: string): void {
    if (this.rejectionSvc.isSeeded(item.claimId)) {
      this.rejectionSvc.decideSeeded(item.claimId);
      return;
    }
    this.stateSvc.patchOverview(item.claimId, {
      rejectionRequestedAt: undefined,
      rejectionRequestedBy: undefined,
      rejectionType: undefined,
      rejectionReason: undefined
    });
    this.logDecision(item, 'Declined', reason);
  }

  private logDecision(
    item: RejectionApproval,
    valueNew: 'Approved' | 'Declined',
    reason?: string
  ): void {
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: item.claimId,
      user: item.requester,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Rejection approval',
      valueOld: 'Requested',
      valueNew: reason ? `${valueNew}: ${reason}` : valueNew
    };
    this.overviewSvc.appendActivities(item.claimId, [activity]);
  }
}
