import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { FinancialOverview } from '../../models/financial-overview.model';
import rawData from '../data/financial-overview.json';

@Injectable({ providedIn: 'root' })
export class MockFinancialOverviewService extends MockBaseService {
  private readonly data = rawData as unknown as FinancialOverview[];

  getByClaimId(claimId: string): Observable<FinancialOverview | null> {
    const found = this.data.find(d => d.claimId === claimId) ?? null;
    return this.respond(found ? structuredClone(found) : null);
  }
}
