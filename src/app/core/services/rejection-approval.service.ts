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

  /** Closes the claim as Claim Rejected. Throws if the closure fails. */
  async approve(item: RejectionApproval): Promise<void> {
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
    this.logStatus(item, 'Closed');
  }

  /** Puts the claim back to Open. */
  decline(item: RejectionApproval): void {
    if (this.rejectionSvc.isSeeded(item.claimId)) {
      this.rejectionSvc.decideSeeded(item.claimId);
      return;
    }
    this.stateSvc.patchOverview(item.claimId, {
      status: 'Open',
      rejectionRequestedAt: undefined,
      rejectionRequestedBy: undefined
    });
    this.logStatus(item, 'Open');
  }

  private logStatus(item: RejectionApproval, valueNew: string): void {
    const activity: ClaimActivity = {
      id: `act-${Date.now()}`,
      claimId: item.claimId,
      user: item.requester,
      timestamp: new Date().toISOString(),
      objectType: 'Claim',
      attribute: 'Status',
      valueOld: 'Pending Rejection Approval',
      valueNew
    };
    this.overviewSvc.appendActivities(item.claimId, [activity]);
  }
}
