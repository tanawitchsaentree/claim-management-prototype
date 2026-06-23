import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RiskAnalysis, RiskScore, RiskStatusLabel } from '../../models';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/risk-analyses.json';

@Injectable({ providedIn: 'root' })
export class MockRiskService extends MockBaseService {
  private cache: RiskAnalysis[] = (rawData as unknown as RiskAnalysis[]).map(r => this.clone(r));

  getByClaim(claimId: string): Observable<RiskAnalysis | null> {
    const found = this.cache.find(r => r.claimId === claimId) ?? null;
    return this.respond(found ? this.clone(found) : null);
  }

  refresh(claimId: string): Observable<RiskAnalysis | null> {
    const idx = this.cache.findIndex(r => r.claimId === claimId);
    if (idx < 0) return this.respond(null);
    const next = this.cache[idx];
    const drift = next.riskScore >= 5 ? -1 : next.riskScore <= 1 ? 1 : (next.riskScore % 2 === 0 ? -1 : 1);
    next.riskScore       = Math.max(1, Math.min(5, next.riskScore + drift)) as RiskScore;
    next.riskStatus      = this.deriveRiskStatus(next.riskScore);
    next.lastScoreUpdated = new Date().toISOString();
    return this.respond(this.clone(next));
  }

  markNoRisk(claimId: string): Observable<RiskAnalysis | null> {
    const idx = this.cache.findIndex(r => r.claimId === claimId);
    if (idx < 0) return this.respond(null);
    this.cache[idx] = {
      ...this.cache[idx],
      riskScore:        1,
      riskStatus:       'Low risk',
      lastScoreUpdated: new Date().toISOString(),
    };
    return this.respond(this.clone(this.cache[idx]));
  }

  startInvestigation(claimId: string, assignee: string, deadline: string): Observable<RiskAnalysis | null> {
    const idx = this.cache.findIndex(r => r.claimId === claimId);
    if (idx < 0) return this.respond(null);
    this.cache[idx] = {
      ...this.cache[idx],
      investigationStatus: 'In progress',
      assignee,
      deadline,
    };
    return this.respond(this.clone(this.cache[idx]));
  }

  resetState(): void {
    this.cache = (rawData as unknown as RiskAnalysis[]).map(r => this.clone(r));
  }

  private deriveRiskStatus(score: RiskScore): RiskStatusLabel {
    if (score <= 2) return 'Low risk';
    if (score <= 3) return 'Potential risk';
    return 'High risk';
  }

  private clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
}
