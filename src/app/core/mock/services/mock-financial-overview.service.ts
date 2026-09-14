import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { FinancialOverview, FinancialReserve } from '../../models/financial-overview.model';
import rawData from '../data/financial-overview.json';

@Injectable({ providedIn: 'root' })
export class MockFinancialOverviewService extends MockBaseService {
  private readonly data = rawData as unknown as FinancialOverview[];
  // Claims not in the static seed (e.g. just-converted orphan claims) get an
  // empty shell here instead of null — the page had no fallback at all
  // before this, so it rendered as a blank page for any claimId outside
  // financial-overview.json. Cached per claimId so additions persist across
  // reads within the session, same idea as MockClaimOverviewService's cache.
  private readonly cache = new Map<string, FinancialOverview>();

  getByClaimId(claimId: string): Observable<FinancialOverview> {
    return this.respond(structuredClone(this.getOrCreate(claimId)));
  }

  // "Add reserve" — the Reserves view's "Update reserves" button had no
  // handler at all before this; there was no way to set a reserve on a
  // claim outside the FNOL wizard's step-reserves.
  addReserve(claimId: string, input: Omit<FinancialReserve, 'reserveId'>): Observable<FinancialReserve> {
    const overview = this.getOrCreate(claimId);
    const reserve: FinancialReserve = { ...input, reserveId: `RES-${Date.now()}` };
    overview.reserves = [...overview.reserves, reserve];
    overview.summary.outstandingReserves += input.reserveValue;
    const section = overview.sections.find(s => s.sectionId === input.section || s.sectionName === input.section);
    if (section) section.reserves = [...section.reserves, reserve];
    return this.respond(reserve);
  }

  private getOrCreate(claimId: string): FinancialOverview {
    const cached = this.cache.get(claimId);
    if (cached) return cached;
    const seeded = this.data.find(d => d.claimId === claimId);
    const overview = seeded ? structuredClone(seeded) : this.buildEmpty(claimId);
    this.cache.set(claimId, overview);
    return overview;
  }

  private buildEmpty(claimId: string): FinancialOverview {
    return {
      claimId,
      summary: { outstandingReserves: 0, completedPayments: 0, pendingPayments: 0, recoveries: 0, incurred: 0 },
      details: { currency: 'EUR', ibnr: 0, rows: [] },
      payments: [],
      reserves: [],
      recoveries: [],
      transactions: [],
      sections: [],
    };
  }
}
