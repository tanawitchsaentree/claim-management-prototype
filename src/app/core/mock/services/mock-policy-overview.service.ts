import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import {
  CoinsuranceParticipant,
  LinkedClaimRow,
  PolicyCoverage,
  PolicyOverview,
} from '../../models/policy-overview.model';
import { Policy } from '../../models/policy.model';
import policiesData from '../data/policies.json';
import policyDetailsData from '../data/policy-details.json';
import claimsData from '../data/claims.json';

interface PolicyDetailEntry {
  coverages:   PolicyCoverage[];
  coinsurance: CoinsuranceParticipant[];
}

interface ClaimRecord {
  claimId:      string;
  policyNumber: string;
  clientName:   string;
  description:  string;
  dateCreated:  string;
  lossDate:     string;
  status:       string;
}

@Injectable({ providedIn: 'root' })
export class MockPolicyOverviewService extends MockBaseService {
  private readonly policies = policiesData as Policy[];
  private readonly details  = policyDetailsData as Record<string, PolicyDetailEntry>;
  private readonly claims   = claimsData as ClaimRecord[];

  // Linked claims are DERIVED from claims.json, not stored alongside the
  // policy. A claim already owns its policyNumber, so a second copy of that
  // linkage in policy-details.json would drift the moment a claim moves
  // policy — the same silent-staleness bug as CHAMP-CLOSURE-001
  // (CONVERSIONS.md 2026-08-06).
  private linkedClaimsFor(policyNumber: string): LinkedClaimRow[] {
    return this.claims
      .filter(c => c.policyNumber === policyNumber)
      .map(c => ({
        claimId:         c.claimId,
        lossDescription: c.description,
        clientName:      c.clientName,
        createdDate:     c.dateCreated,
        dateOfLoss:      c.lossDate,
        status:          c.status,
      }))
      .sort((a, b) => b.dateOfLoss.localeCompare(a.dateOfLoss));
  }

  getByPolicyNumber(policyNumber: string): Observable<PolicyOverview | null> {
    const policy = this.policies.find(p => p.policyNumber === policyNumber);
    if (!policy) return this.respond(null);

    const detail = this.details[policyNumber];
    return this.respond<PolicyOverview>({
      ...policy,
      coverages:    detail ? structuredClone(detail.coverages)   : [],
      coinsurance:  detail ? structuredClone(detail.coinsurance) : [],
      linkedClaims: this.linkedClaimsFor(policyNumber),
    });
  }

  // The Policy overview route is claim-scoped (claims/:id/policy) — the claim
  // record is what knows which policy to show.
  getByClaimId(claimId: string): Observable<PolicyOverview | null> {
    const claim = this.claims.find(c => c.claimId === claimId);
    if (!claim) return this.respond(null);
    return this.getByPolicyNumber(claim.policyNumber).pipe(map(p => p));
  }
}
