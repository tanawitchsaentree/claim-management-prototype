import { LossEventSummary } from './dashboard-extended.model';

/**
 * Loss Event Overview — the screen reached from any `/loss-events/:id/overview`
 * link (loss events list, claims-portfolio widget, FNOL summary when one
 * submission produces more than one claim).
 *
 * Field names follow the production `claims-management-loss-overview` MFE's
 * `GeneralInfo` so the two stay comparable: proximateCause,
 * eventOccurrenceDate/Time, eventLocation, causesRelations, damagesCaused.
 * `eventOccurrenceDate` is NOT repeated here — it is `LossEventSummary.eventDate`,
 * and duplicating it in the JSON is how the two drift apart.
 */
export interface LossEventDamagesCaused {
  type: string;       // e.g. 'Material damage'
  damages: string[];  // e.g. ['Building', 'Contents']
}

export interface LossEventGeneralInfo {
  proximateCause: string[];
  eventOccurrenceTime: string;
  eventLocation: string;
  causesRelations: string[];
  damagesCaused: LossEventDamagesCaused[];
}

/** A loss-events.json record: portfolio summary + the general-info block. */
export interface LossEventDetail extends LossEventSummary, LossEventGeneralInfo {}

export interface LossEventRelatedClaim {
  claimId: string;
  claimant: string;
  claimHandler: string;
  claimStatus: string;
  lossAmount: number;
  currency: string;
}

export interface LossEventPartyRow {
  partyId: string;
  partyName: string;
  role: string;
  clearanceStatus: string;
  claimId: string;
}

export interface LossEventDocumentRow {
  documentId: string;
  claimId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

/**
 * Financial roll-up across the event's claims. Upstream leaves this tab as
 * placeholder text; totals are only reported per currency because the event's
 * claims can be booked in EUR, USD and CHF — one summed number would be fiction.
 */
export interface LossEventCurrencyTotal {
  currency: string;
  claimCount: number;
  lossAmount: number;
}

export interface LossEventFinancials {
  reserveCurrency: string;
  totalReserve: number;
  totals: LossEventCurrencyTotal[];
}

export interface LossEventOverview {
  summary: LossEventSummary;
  generalInfo: LossEventGeneralInfo;
  relatedClaims: LossEventRelatedClaim[];
  parties: LossEventPartyRow[];
  financials: LossEventFinancials;
  documents: LossEventDocumentRow[];
}
