import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { RejectionApproval } from '../../models/approval.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import rejectionsData from '../data/rejection-approvals.json';

// BMPCC-17630 — coverage-related rejections waiting for second-level approval.
// Not a separate store: the claim itself carries the status, so the Claims tab
// and Claim Overview can never disagree.
@Injectable({ providedIn: 'root' })
export class MockRejectionApprovalService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly seeded = rejectionsData as RejectionApproval[];
  // Seeded rows aren't backed by a real pending claim, so deciding on one can
  // only hide it for this session (same as MockApprovalService).
  private readonly decidedSeeded = signal<Set<string>>(new Set());

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
    const seeded = this.seeded.filter(
      r => !this.decidedSeeded().has(r.claimId) && !pending.some(p => p.claimId === r.claimId)
    );
    return this.list([...pending, ...seeded]);
  }

  isSeeded(claimId: string): boolean {
    return this.seeded.some(r => r.claimId === claimId) && this.isStillSeeded(claimId);
  }

  decideSeeded(claimId: string): void {
    this.decidedSeeded.update(s => new Set(s).add(claimId));
  }

  private isStillSeeded(claimId: string): boolean {
    return this.stateSvc.state().overviews[claimId]?.status !== 'Pending Rejection Approval';
  }
}
