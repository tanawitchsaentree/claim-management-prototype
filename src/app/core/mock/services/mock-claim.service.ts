import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Claim, ClaimStatus, LineOfBusiness, Priority } from '../../models';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

export interface ClaimFilter {
  status?: ClaimStatus;
  lineOfBusiness?: LineOfBusiness;
  priority?: Priority;
  assignee?: string;
  search?: string;
}

@Injectable({ providedIn: 'root' })
export class MockClaimService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private get claims() { return this.stateSvc.state().claims; }

  getAll(filter?: ClaimFilter): Observable<Claim[]> {
    let result = [...this.claims];

    if (filter) {
      if (filter.status)          result = result.filter(c => c.status === filter.status);
      if (filter.lineOfBusiness)  result = result.filter(c => c.lineOfBusiness === filter.lineOfBusiness);
      if (filter.priority)        result = result.filter(c => c.priority === filter.priority);
      if (filter.assignee)        result = result.filter(c => c.assignee === filter.assignee);
      if (filter.search) {
        const q = filter.search.toLowerCase();
        result = result.filter(c =>
          c.claimId.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        );
      }
    }

    return this.list(result);
  }

  getById(claimId: string): Observable<Claim> {
    return this.findById(this.claims as unknown as Record<string, unknown>[], 'claimId', claimId) as unknown as Observable<Claim>;
  }

  create(payload: Omit<Claim, 'claimId' | 'dateCreated'>): Observable<Claim> {
    const newClaim: Claim = {
      ...payload,
      claimId:     `CLM-${Date.now()}`,
      dateCreated: new Date().toISOString().split('T')[0],
    } as Claim;
    this.stateSvc.patchClaims(claims => [...claims, newClaim]);
    return this.respond(newClaim);
  }

  update(claimId: string, payload: Partial<Claim>): Observable<Claim> {
    const existing = this.claims.find(c => c.claimId === claimId);
    if (!existing) {
      return this.findById([], 'claimId', claimId) as unknown as Observable<Claim>;
    }
    const updated = { ...existing, ...payload };
    this.stateSvc.patchClaims(claims => claims.map(c => c.claimId === claimId ? updated : c));
    return this.respond(updated);
  }

  delete(claimId: string): Observable<void> {
    this.stateSvc.patchClaims(claims => claims.filter(c => c.claimId !== claimId));
    return this.respond(undefined as void);
  }
}
