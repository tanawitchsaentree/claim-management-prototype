import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import {
  FinancialOverview,
  FinancialReserve,
  FinancialReserveWithHistory
} from '../../models/financial-overview.model';
import { MockSectionService } from './mock-section.service';
import { MockStateService } from '../state/mock-state.service';
import policiesData from '../data/policies.json';

// The signed-in persona (header avatar "MM"). No auth service exists yet; this
// matches the CREATOR stand-in in step-summary.component.ts.
const CURRENT_USER = 'Mara Mustermann';

// dd-MM-yyyy, same as the seeded history entries.
function formatDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

// Short label after the party in the Reserves table's Section column.
const SECTION_CODES: Record<string, string> = {
  'material-damage': 'PD',
  'business-interruption': 'BI'
};
export function sectionCodeFor(damageType: string): string {
  return (
    SECTION_CODES[damageType] ??
    damageType.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())
  );
}

@Injectable({ providedIn: 'root' })
export class MockFinancialOverviewService extends MockBaseService {
  private readonly sectionSvc = inject(MockSectionService);
  private readonly stateSvc = inject(MockStateService);

  getByClaimId(claimId: string): Observable<FinancialOverview> {
    return this.respond(structuredClone(this.getOrCreate(claimId)));
  }

  // "Update reserves" and the FNOL submit both land here. The claim-level
  // list is the single source of truth (claim closure reads it); a section's
  // reserves are the ones whose sectionId points at it.
  addReserve(
    claimId: string,
    input: Omit<FinancialReserve, 'reserveId'>
  ): Observable<FinancialReserve> {
    const overview = structuredClone(this.getOrCreate(claimId));
    const section = overview.sections.find(
      s => s.sectionId === input.section || s.sectionName === input.section
    );
    const real = section ? this.sectionSvc.getByClaimIdSync(claimId).find(r => r.id === section.sectionId) : undefined;
    const reserve: FinancialReserveWithHistory = {
      ...input,
      section: section?.sectionName ?? input.section,
      sectionId: section?.sectionId,
      sectionCode: input.sectionCode ?? section?.code ?? (real ? sectionCodeFor(real.damageType) : undefined),
      reserveId: this.nextReserveId(claimId, overview, section?.sectionId, input.damagedItem),
      history: [
        {
          date: formatDate(new Date()),
          amount: input.reserveValue,
          reason: 'Initial reserve set',
          user: CURRENT_USER
        }
      ]
    };
    overview.reserves = [...overview.reserves, reserve];
    overview.summary.outstandingReserves += input.reserveValue;
    if (section) {
      // Close Section's "Reserves released to zero" checklist item reads
      // ClaimSection.hasOpenReserves directly — a reserve attached here
      // without this flip left that check green forever, letting a section
      // with real open money get closed unblocked.
      // patchSection mutates MockSectionService's state synchronously inside
      // the call itself — the returned Observable is just its respond()
      // wrapper and doesn't need subscribing to take effect.
      const hasOpenReserves = overview.reserves.some(
        r => r.sectionId === section.sectionId && r.status !== 'Rejected' && r.reserveValue > 0
      );
      this.sectionSvc.patchSection(section.sectionId, { hasOpenReserves });
    }
    this.stateSvc.patchFinancialOverview(claimId, overview);
    return this.respond(reserve);
  }

  // RES-C-00063671-2026.234.1.1.2 (shape taken from the production screen):
  // client code, then year . claim no . section no . damaged item no . reserve no.
  // What each trailing number means is my reading of the shape, not confirmed.
  private nextReserveId(
    claimId: string,
    overview: FinancialOverview,
    sectionId: string | undefined,
    damagedItem: string
  ): string {
    const claim = this.stateSvc.state().claims.find(c => c.claimId === claimId);
    const clientCode =
      (policiesData as { policyNumber: string; clientNameCode?: string }[]).find(
        p => p.policyNumber === claim?.policyNumber
      )?.clientNameCode ?? 'C-00000000';
    const year = (claim?.dateCreated ?? '').slice(0, 4) || String(new Date().getFullYear());
    const claimNo = claimId.match(/(\d+)$/)?.[1] ?? '0';
    const sectionNo = sectionId ? overview.sections.findIndex(s => s.sectionId === sectionId) + 1 : 0;
    const inSection = overview.reserves.filter(r => (r.sectionId ?? undefined) === sectionId);
    const items = [...new Set(inSection.map(r => r.damagedItem).filter(Boolean))];
    const itemNo = damagedItem ? (items.includes(damagedItem) ? items.indexOf(damagedItem) : items.length) + 1 : 0;
    const reserveNo = inSection.filter(r => (r.damagedItem || '') === (damagedItem || '')).length + 1;
    return `RES-${clientCode}-${year}.${claimNo}.${sectionNo}.${itemNo}.${reserveNo}`;
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
        code: sectionCodeFor(section.damageType),
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
