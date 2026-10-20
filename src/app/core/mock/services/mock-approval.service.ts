import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { UrgentApproval } from '../../models/approval.model';
import { MockBaseService } from './mock-base.service';
import { MockFinancialOverviewService } from './mock-financial-overview.service';
import approvalsData from '../data/approvals.json';

@Injectable({ providedIn: 'root' })
export class MockApprovalService extends MockBaseService {
  private readonly financialSvc = inject(MockFinancialOverviewService);
  private readonly approvals = approvalsData as UrgentApproval[];
  // The seeded requests are not backed by a real reserve, so deciding on one
  // can only hide it for this session.
  private readonly decidedSeeded = signal<Set<string>>(new Set());

  /** Seeded requests plus every real Pending reserve on any claim. */
  getAll(): Observable<UrgentApproval[]> {
    const seeded = this.approvals.filter(a => !this.decidedSeeded().has(a.requestId));
    return forkJoin([this.list(seeded), this.financialSvc.getPendingApprovals()]).pipe(
      // A seeded request whose reserve now sits on its claim as a Pending row
      // (same claim, same amount) would show twice: keep the real one.
      map(([s, real]) => [
        ...real,
        ...s.filter(a => !real.some(r => r.claimId === a.claimId && r.amount === a.amount))
      ])
    );
  }

  /** Real reserves carry a RES- id; anything else is one of the seeded requests. */
  isRealReserve(requestId: string): boolean {
    return requestId.startsWith('RES-');
  }

  decideSeeded(requestId: string): void {
    this.decidedSeeded.update(s => new Set(s).add(requestId));
  }
}
