import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { FinancialOverview, FinancialReserve } from '../../models/financial-overview.model';
import { MockSectionService } from './mock-section.service';
import { MockStateService } from '../state/mock-state.service';

@Injectable({ providedIn: 'root' })
export class MockFinancialOverviewService extends MockBaseService {
  private readonly sectionSvc = inject(MockSectionService);
  private readonly stateSvc = inject(MockStateService);

  getByClaimId(claimId: string): Observable<FinancialOverview> {
    return this.respond(structuredClone(this.getOrCreate(claimId)));
  }

  // "Add reserve" — the Reserves view's "Update reserves" button had no
  // handler at all before this; there was no way to set a reserve on a
  // claim outside the FNOL wizard's step-reserves.
  addReserve(
    claimId: string,
    input: Omit<FinancialReserve, 'reserveId'>
  ): Observable<FinancialReserve> {
    const overview = structuredClone(this.getOrCreate(claimId));
    const reserve: FinancialReserve = { ...input, reserveId: `RES-${Date.now()}` };
    overview.reserves = [...overview.reserves, reserve];
    overview.summary.outstandingReserves += input.reserveValue;
    const section = overview.sections.find(
      s => s.sectionId === input.section || s.sectionName === input.section
    );
    if (section) {
      section.reserves = [...section.reserves, reserve];
      // Close Section's "Reserves released to zero" checklist item reads
      // ClaimSection.hasOpenReserves directly — a reserve attached here
      // without this flip left that check green forever, letting a section
      // with real open money get closed unblocked.
      // patchSection mutates MockSectionService's state synchronously inside
      // the call itself — the returned Observable is just its respond()
      // wrapper and doesn't need subscribing to take effect.
      const hasOpenReserves = section.reserves.some(
        r => r.status !== 'Rejected' && r.reserveValue > 0
      );
      this.sectionSvc.patchSection(section.sectionId, { hasOpenReserves });
    }
    this.stateSvc.patchFinancialOverview(claimId, overview);
    return this.respond(reserve);
  }

  private getOrCreate(claimId: string): FinancialOverview {
    let overview = this.stateSvc.state().financialOverviews[claimId];
    if (!overview) {
      overview = this.buildEmpty(claimId);
      this.stateSvc.ensureFinancialOverview(claimId, overview);
    }
    const synced = structuredClone(overview);
    const changed = this.syncSections(synced, claimId);
    if (changed) this.stateSvc.patchFinancialOverview(claimId, synced);
    return synced;
  }

  // The claim file's real sections (MockSectionService) are the source of
  // truth for what sections exist — this financial-domain list used to be
  // its own disconnected concept, seeded once and never updated, so a
  // section added after a claim's FinancialOverview was first read (or any
  // section on a brand-new claim) never appeared here. That meant "Add
  // reserve"'s Section field silently never showed up (the modal only
  // renders it when this list is non-empty) and a section's own reserves
  // could never be attributed to it, so the Close Section checklist's
  // "Reserves released to zero" check always passed even with open money
  // on the claim. Re-synced on every read — cheap, and additive only
  // (existing FinancialSection data, e.g. already-attached reserves, is
  // preserved; nothing is removed if a ClaimSection is later deleted).
  private syncSections(overview: FinancialOverview, claimId: string): boolean {
    const realSections = this.sectionSvc.getByClaimIdSync(claimId);
    let changed = false;
    for (const section of realSections) {
      if (overview.sections.some(s => s.sectionId === section.id)) continue;
      overview.sections.push({
        sectionId: section.id,
        sectionName: section.name,
        currency: overview.details.currency,
        exchangeRate: 1,
        baseCurrency: overview.details.currency,
        summaryRows: [],
        payments: [],
        reserves: [],
        recoveries: []
      });
      changed = true;
    }
    return changed;
  }

  private buildEmpty(claimId: string): FinancialOverview {
    return {
      claimId,
      summary: {
        outstandingReserves: 0,
        completedPayments: 0,
        pendingPayments: 0,
        recoveries: 0,
        incurred: 0
      },
      details: { currency: 'EUR', ibnr: 0, rows: [] },
      payments: [],
      reserves: [],
      recoveries: [],
      transactions: [],
      sections: []
    };
  }
}
