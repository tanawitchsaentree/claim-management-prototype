import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Claim, ClaimStatus, LineOfBusiness, Priority } from '../../models';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

const VALID_LINES_OF_BUSINESS: LineOfBusiness[] = [
  'Property',
  'Liability',
  'Marine',
  'Cyber',
  'Engineering'
];

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
  private get claims() {
    return this.stateSvc.state().claims;
  }

  getAll(filter?: ClaimFilter): Observable<Claim[]> {
    let result = [...this.claims];

    if (filter) {
      if (filter.status) result = result.filter(c => c.status === filter.status);
      if (filter.lineOfBusiness)
        result = result.filter(c => c.lineOfBusiness === filter.lineOfBusiness);
      if (filter.priority) result = result.filter(c => c.priority === filter.priority);
      if (filter.assignee) result = result.filter(c => c.assignee === filter.assignee);
      if (filter.search) {
        const q = filter.search.toLowerCase();
        result = result.filter(
          c =>
            c.claimId.toLowerCase().includes(q) ||
            c.clientName.toLowerCase().includes(q) ||
            c.description?.toLowerCase().includes(q)
        );
      }
    }

    return this.list(result);
  }

  getById(claimId: string): Observable<Claim> {
    return this.findById(
      this.claims as unknown as Record<string, unknown>[],
      'claimId',
      claimId
    ) as unknown as Observable<Claim>;
  }

  create(payload: Omit<Claim, 'claimId' | 'dateCreated'>, idPrefix = 'CLM'): Observable<Claim> {
    const newClaim: Claim = {
      ...payload,
      claimId: `${idPrefix}-${Date.now()}`,
      dateCreated: new Date().toISOString().split('T')[0]
    } as Claim;
    this.stateSvc.patchClaims(claims => [...claims, newClaim]);
    return this.respond(newClaim);
  }

  // Used by the FNOL search page's Claims tab — run against every claim
  // (regular + orphan) so an orphan claim shows up as a claim, not a
  // separate concept. claimLossEventNumber matches production's General
  // Search screen (inputClaimNumber) — a claim-number lookup, checked
  // against both claimId and lossEventId.
  searchClaims(criteria: {
    clientName?: string;
    policyNumber?: string;
    claimLossEventNumber?: string;
  }): Observable<Claim[]> {
    const hasAny = !!(
      criteria.clientName ||
      criteria.policyNumber ||
      criteria.claimLossEventNumber
    );
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
    if (criteria.claimLossEventNumber) {
      const q = criteria.claimLossEventNumber.toLowerCase();
      results = results.filter(
        c =>
          c.claimId.toLowerCase().includes(q) ||
          (c.lossEventId?.toLowerCase().includes(q) ?? false)
      );
    }
    return this.list(results);
  }

  update(claimId: string, payload: Partial<Claim>): Observable<Claim> {
    const existing = this.claims.find(c => c.claimId === claimId);
    if (!existing) {
      return this.findById([], 'claimId', claimId) as unknown as Observable<Claim>;
    }
    const updated = { ...existing, ...payload };
    this.stateSvc.patchClaims(claims => claims.map(c => (c.claimId === claimId ? updated : c)));
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
      skeletonState: 'linked'
    });
  }

  // Skeleton lifecycle — Abandon / Reopen / Extend SLA. These sat as
  // context-menu items wired to a no-op ("Phase 2 actions") until now; the
  // only real transition was Convert. All three are plain status/field
  // writes on the same claim record, same rationale as linkPolicy().
  //
  // Abandoning sets status: 'Closed' too — business rules only recognise
  // Open/Closed (BMPCC-17927 functional review, 2026-09-22); an abandoned
  // skeleton isn't being worked any further, so it reads as closed, not a
  // third open-ended state. ASSUMPTION: not yet confirmed with the business
  // whether "abandoned" should map to Closed specifically — flagged for
  // Marlene's review, not settled.
  abandonSkeleton(claimId: string, reason: string): Observable<Claim> {
    return this.update(claimId, {
      status: 'Closed',
      skeletonState: 'abandoned',
      abandonReason: reason
    });
  }

  reopenSkeleton(claimId: string): Observable<Claim> {
    return this.update(claimId, {
      status: 'Open',
      skeletonState: 'awaiting-policy',
      abandonReason: undefined
    });
  }

  // Fixed +3 days, matching the SLA convertToRegularClaim() already grants a
  // freshly-converted claim's follow-up task — not an arbitrary number.
  extendSla(claimId: string, additionalDays = 3): Observable<Claim> {
    const current = this.claims.find(c => c.claimId === claimId)?.slaDeadlineDays ?? 0;
    return this.update(claimId, { slaDeadlineDays: current + additionalDays });
  }

  delete(claimId: string): Observable<void> {
    this.stateSvc.patchClaims(claims => claims.filter(c => c.claimId !== claimId));
    return this.respond(undefined as void);
  }
}
