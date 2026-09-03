import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Claim } from '../../models/claim.model';
import { Party } from '../../models/party.model';
import {
  LossEventCurrencyTotal,
  LossEventDetail,
  LossEventDocumentRow,
  LossEventFinancials,
  LossEventGeneralInfo,
  LossEventOverview,
  LossEventPartyRow,
  LossEventRelatedClaim,
} from '../../models/loss-event-overview.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import lossEventsData from '../data/loss-events.json';
import claimsData from '../data/claims.json';
import partiesData from '../data/parties.json';
import documentsData from '../data/claim-documents.json';

@Injectable({ providedIn: 'root' })
export class MockLossEventService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  private readonly rawEvents = lossEventsData as unknown as LossEventDetail[];
  private readonly claims = claimsData as unknown as Claim[];
  private readonly parties = partiesData as unknown as Party[];
  private readonly documents = documentsData as LossEventDocumentRow[];

  /**
   * The summary half comes from MockStateService so scenario overrides (status,
   * reserve, claim count) still apply; the general-info half is read from the raw
   * JSON, because state types its copy as LossEventSummary and drops those five
   * fields from the type even though the values survive.
   */
  getOverview(lossEventId: string): Observable<LossEventOverview | null> {
    const summary = this.stateSvc.state().lossEvents.find(e => e.lossEventId === lossEventId);
    const raw = this.rawEvents.find(e => e.lossEventId === lossEventId);
    if (!summary || !raw) return this.respond(null);

    const claims = this.claims.filter(c => c.lossEventId === lossEventId);

    return this.respond({
      summary,
      generalInfo: this.toGeneralInfo(raw),
      relatedClaims: claims.map(c => this.toRelatedClaim(c)),
      parties: this.collectParties(claims),
      financials: this.rollUp(summary.totalReserve, summary.currency, claims),
      documents: this.collectDocuments(claims),
    } satisfies LossEventOverview);
  }

  private toGeneralInfo(raw: LossEventDetail): LossEventGeneralInfo {
    return structuredClone({
      proximateCause: raw.proximateCause,
      eventOccurrenceTime: raw.eventOccurrenceTime,
      eventLocation: raw.eventLocation,
      causesRelations: raw.causesRelations,
      damagesCaused: raw.damagesCaused,
    });
  }

  private toRelatedClaim(c: Claim): LossEventRelatedClaim {
    return {
      claimId: c.claimId,
      claimant: c.clientName,
      // Unassigned is a real state in claims.json (assignee: null) — the table
      // says so rather than rendering a blank cell.
      claimHandler: c.assignee ?? 'Unassigned',
      claimStatus: c.status,
      lossAmount: c.lossAmount,
      currency: c.currency,
    };
  }

  /**
   * parties.json predates claims.json's `CLM-` prefix and still keys its records
   * as `CL-2024-002`. Both sides are normalised here rather than renumbering that
   * file, which the party tree and risk-analyses.json also read from.
   */
  private collectParties(claims: Claim[]): LossEventPartyRow[] {
    const wanted = new Set(claims.map(c => this.normaliseClaimId(c.claimId)));
    const rows: LossEventPartyRow[] = [];
    for (const p of this.parties) {
      if (!p.claimId || !wanted.has(this.normaliseClaimId(p.claimId))) continue;
      for (const role of p.roles) {
        rows.push({
          partyId: p.partyId,
          partyName: p.legalName,
          role,
          clearanceStatus: p.clearanceStatus,
          claimId: p.claimId,
        });
      }
    }
    return rows;
  }

  private normaliseClaimId(id: string): string {
    return id.replace(/^CLM?-/, '');
  }

  private collectDocuments(claims: Claim[]): LossEventDocumentRow[] {
    const ids = new Set(claims.map(c => c.claimId));
    return this.documents.filter(d => ids.has(d.claimId)).map(d => structuredClone(d));
  }

  private rollUp(totalReserve: number, reserveCurrency: string, claims: Claim[]): LossEventFinancials {
    const byCurrency = new Map<string, LossEventCurrencyTotal>();
    for (const c of claims) {
      const row = byCurrency.get(c.currency) ?? { currency: c.currency, claimCount: 0, lossAmount: 0 };
      row.claimCount += 1;
      row.lossAmount += c.lossAmount;
      byCurrency.set(c.currency, row);
    }
    return {
      reserveCurrency,
      totalReserve,
      totals: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    };
  }
}
