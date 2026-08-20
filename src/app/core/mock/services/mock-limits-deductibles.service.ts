import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ClaimLimitsDeductibles, Deductible } from '../../models/deductible.model';
import rawData from '../data/limits-deductibles.json';

@Injectable({ providedIn: 'root' })
export class MockLimitsDeductiblesService extends MockBaseService {
  private readonly data = rawData as unknown as ClaimLimitsDeductibles[];

  private readonly empty: ClaimLimitsDeductibles = { claimId: '', limits: [], deductibles: [] };

  getByClaimId(claimId: string): Observable<ClaimLimitsDeductibles> {
    const found = this.data.find(d => d.claimId === claimId);
    return this.respond(found ? structuredClone(found) : structuredClone(this.empty));
  }

  getApplicableDeductibles(claimId: string, sectionId?: string): Observable<Deductible[]> {
    const found = this.data.find(d => d.claimId === claimId);
    const all = found ? found.deductibles : [];
    const applicable = all.filter(d => d.level === 'claim' || (d.level === 'section' && d.sectionId === sectionId));
    return this.respond(structuredClone(applicable));
  }
}
