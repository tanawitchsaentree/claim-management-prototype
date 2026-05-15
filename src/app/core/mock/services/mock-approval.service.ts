import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { UrgentApproval } from '../../models/approval.model';
import { MockBaseService } from './mock-base.service';
import approvalsData from '../data/approvals.json';

@Injectable({ providedIn: 'root' })
export class MockApprovalService extends MockBaseService {
  private readonly approvals = approvalsData as UrgentApproval[];

  getAll(): Observable<UrgentApproval[]> {
    return this.list(this.approvals);
  }
}
