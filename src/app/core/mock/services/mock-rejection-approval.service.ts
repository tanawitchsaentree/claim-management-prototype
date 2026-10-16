import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RejectionApproval } from '../../models/approval.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

// BMPCC-17630 — coverage-related rejections waiting for second-level approval.
// Not a separate store: the claim itself carries the status, so the Claims tab
// and Claim Overview can never disagree.
@Injectable({ providedIn: 'root' })
export class MockRejectionApprovalService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  getPending(): Observable<RejectionApproval[]> {
    const pending = Object.values(this.stateSvc.state().overviews)
      .filter(o => o.status === 'Pending Rejection Approval')
      .map(o => ({
        claimId: o.claimId,
        client: o.client,
        lineOfBusiness: o.lineOfBusiness,
        requester: o.rejectionRequestedBy ?? o.assignedHandler,
        dateRequested: (o.rejectionRequestedAt ?? '').split('T')[0]
      }));
    return this.list(pending);
  }
}
