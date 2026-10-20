import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import {
  FinancialOverview,
  FinancialPayment,
  FinancialReserve,
  FinancialReserveWithHistory
} from '../../models/financial-overview.model';
import { MockSectionService } from './mock-section.service';
import { MockStateService } from '../state/mock-state.service';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { AuthService } from '../../services/auth';
import { UrgentApproval } from '../../models/approval.model';
import policiesData from '../data/policies.json';
import lookupsData from '../data/lookups.json';

// Claims store the country as a name or a code; the Approvals OE column wants the code.
function countryCode(country: string | undefined): string {
  if (!country) return '';
  const hit = lookupsData.countries.find(
    c => c.value === country || c.label.toLowerCase() === country.toLowerCase()
  );
  return hit?.value ?? country;
}

// dd-MM-yyyy, same as the seeded history entries.
const appDate = new AppDatePipe();
const todayLabel = (): string => appDate.transform(new Date());

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
  private readonly auth = inject(AuthService);

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
      requestedBy: this.auth.user().email,
      reserveId: this.nextReserveId(claimId, overview, section?.sectionId, input.damagedItem),
      history: [
        {
          date: todayLabel(),
          amount: input.reserveValue,
          reason: 'Initial reserve set',
          user: this.auth.user().name
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

  /**
   * Make payment (GG booking ticket AC-17). New payments start Pending: they
   * go to approval first and only reach Global Genius once approved (epic
   * BMPCC-18348 AC2), so no booking status yet. `sectionId` (optional) keeps
   * the section-level list in step.
   */
  addPayment(
    claimId: string,
    input: Omit<FinancialPayment, 'paymentId' | 'status'>,
    sectionId?: string
  ): Observable<FinancialPayment> {
    const overview = structuredClone(this.getOrCreate(claimId));
    const prefix = overview.payments[0]?.paymentId.split('-')[0] ?? claimId;
    const payment: FinancialPayment = {
      ...input,
      handler: input.handler || this.auth.user().name,
      paymentDate: input.paymentDate || todayLabel(),
      paymentId: `${prefix}-${overview.payments.length + 1}`,
      status: 'Pending'
    };
    overview.payments = [...overview.payments, payment];
    overview.summary.pendingPayments += input.amount;
    const section = overview.sections.find(s => s.sectionId === sectionId);
    if (section) section.payments = [...section.payments, payment];
    this.stateSvc.patchFinancialOverview(claimId, overview);
    return this.respond(payment);
  }

  /** Every reserve still waiting for approval, across all claims, as approval requests. */
  getPendingApprovals(): Observable<UrgentApproval[]> {
    const state = this.stateSvc.state();
    const out: UrgentApproval[] = [];
    for (const [claimId, overview] of Object.entries(state.financialOverviews)) {
      const claim = state.claims.find(c => c.claimId === claimId);
      for (const r of overview.reserves as FinancialReserveWithHistory[]) {
        if (r.status !== 'Pending') continue;
        out.push({
          requestId: r.reserveId,
          claimId,
          oe: countryCode(claim?.location?.country),
          lineOfBusiness: claim?.lineOfBusiness ?? '',
          reserveType: r.reserveType as UrgentApproval['reserveType'],
          currency: r.currency,
          amount: r.reserveValue,
          requester: r.requestedBy ?? '',
          dateRequested: r.history?.[r.history.length - 1]?.date
        });
      }
    }
    return this.respond(out);
  }

  /** Approver decision on a Pending reserve. */
  decideReserve(
    claimId: string,
    reserveId: string,
    decision: 'Approved' | 'Rejected'
  ): Observable<FinancialReserve | null> {
    return this.changeReserve(claimId, reserveId, (r, overview) => {
      if (decision === 'Rejected') overview.summary.outstandingReserves -= r.reserveValue;
      r.status = decision;
      return decision;
    });
  }

  /** Handler changes the amount of an existing reserve: needs approving again. */
  updateReserveAmount(
    claimId: string,
    reserveId: string,
    reserveValue: number,
    reason: string
  ): Observable<FinancialReserve | null> {
    return this.changeReserve(claimId, reserveId, (r, overview) => {
      overview.summary.outstandingReserves += reserveValue - r.reserveValue;
      r.reserveValue = reserveValue;
      r.status = 'Pending';
      r.requestedBy = this.auth.user().email;
      return reason;
    });
  }

  private changeReserve(
    claimId: string,
    reserveId: string,
    apply: (r: FinancialReserveWithHistory, overview: FinancialOverview) => string
  ): Observable<FinancialReserve | null> {
    const overview = structuredClone(this.getOrCreate(claimId));
    const reserve = (overview.reserves as FinancialReserveWithHistory[]).find(
      r => r.reserveId === reserveId
    );
    if (!reserve) return this.respond(null);
    const reason = apply(reserve, overview);
    reserve.history = [
      ...(reserve.history ?? []),
      {
        date: todayLabel(),
        amount: reserve.reserveValue,
        reason,
        user: this.auth.user().name
      }
    ];
    if (reserve.sectionId) {
      const hasOpenReserves = overview.reserves.some(
        r => r.sectionId === reserve.sectionId && r.status !== 'Rejected' && r.reserveValue > 0
      );
      this.sectionSvc.patchSection(reserve.sectionId, { hasOpenReserves });
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
