import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Claim, ClaimStatus, LineOfBusiness, Priority } from '../../models';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

const VALID_LINES_OF_BUSINESS: LineOfBusiness[] = ['Property', 'Liability', 'Marine', 'Cyber', 'Engineering'];

interface LinkablePolicy {
  policyNumber: string;
  lineOfBusiness: string;
  broker?: string;
}

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

  create(payload: Omit<Claim, 'claimId' | 'dateCreated'>, idPrefix = 'CLM'): Observable<Claim> {
    const newClaim: Claim = {
      ...payload,
      claimId:     `${idPrefix}-${Date.now()}`,
      dateCreated: new Date().toISOString().split('T')[0],
    } as Claim;
    this.stateSvc.patchClaims(claims => [...claims, newClaim]);
    return this.respond(newClaim);
  }

  // Used by the FNOL search page's Claims tab — same 3-field search the old
  // skeleton-only search used, now run against every claim (regular +
  // orphan) so an orphan claim shows up as a claim, not a separate concept.
  searchClaims(criteria: { clientName?: string; policyNumber?: string }): Observable<Claim[]> {
    const hasAny = !!(criteria.clientName || criteria.policyNumber);
    if (!hasAny) return this.respond([]);

    let results = [...this.claims];
    if (criteria.clientName) {
      const q = criteria.clientName.toLowerCase();
      results = results.filter(c => c.clientName.toLowerCase().includes(q));
    }
    if (criteria.policyNumber) {
      const q = criteria.policyNumber.toLowerCase();
      results = results.filter(c => c.policyNumber.toLowerCase().includes(q));
    }
    return this.list(results);
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

  // "Convert to claim": link a real policy onto an orphan claim in place —
  // same claimId, same history, just gains a policy and moves off the
  // awaiting-policy lifecycle. No new claim record is created; a claim
  // number is assigned once at intake and enriched over time, not reissued.
  linkPolicy(claimId: string, policy: LinkablePolicy): Observable<Claim> {
    const lineOfBusiness = VALID_LINES_OF_BUSINESS.includes(policy.lineOfBusiness as LineOfBusiness)
      ? (policy.lineOfBusiness as LineOfBusiness)
      : undefined;
    return this.update(claimId, {
      policyNumber: policy.policyNumber,
      ...(lineOfBusiness ? { lineOfBusiness } : {}),
      ...(policy.broker ? { broker: policy.broker } : {}),
      status: 'Open',
    });
  }

  delete(claimId: string): Observable<void> {
    this.stateSvc.patchClaims(claims => claims.filter(c => c.claimId !== claimId));
    return this.respond(undefined as void);
  }
}
