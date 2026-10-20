import { FinancialOverview } from '../../../core/models/financial-overview.model';
import { Bookable, needsHandler, withFinance } from '../../../core/models/gg-booking.model';

export type FinancialListView = 'payments' | 'reserves' | 'recovery';

export interface NotBookedLink {
  view: FinancialListView;
  text: string;
}

export interface NotBookedGroup {
  total: number;
  links: NotBookedLink[];
}

// singular, plural
const WORDS: Record<FinancialListView, [string, string]> = {
  payments: ['payment', 'payments'],
  reserves: ['reserve', 'reserves'],
  recovery: ['recovery', 'recoveries']
};

type Row = Bookable & { status: string };

/** How many rows on one list wait for the handler (the "Needs you" chip). Same rule as the summary line and the bell. */
export function needsYouCount(rows: Row[]): number {
  return rows.filter(r => needsHandler(r.status, r)).length;
}

export interface NotBookedSummary {
  /** Everything Global Genius couldn't book: needs you + with Finance. */
  total: number;
  needYou: NotBookedGroup;
  withFinance: NotBookedGroup;
  /** Approver send-backs: counted by "Needs you" too, but not a booking problem. */
  sentBack: NotBookedGroup;
}

function group(lists: Record<FinancialListView, Row[]>, keep: (r: Row) => boolean): NotBookedGroup {
  const links: NotBookedLink[] = [];
  let total = 0;
  for (const view of Object.keys(lists) as FinancialListView[]) {
    const n = lists[view].filter(keep).length;
    if (n > 0) {
      total += n;
      links.push({ view, text: `${n} ${WORDS[view][n === 1 ? 0 : 1]}` });
    }
  }
  return { total, links };
}

export function notBookedSummary(fo: FinancialOverview): NotBookedSummary {
  const lists: Record<FinancialListView, Row[]> = {
    payments: fo.payments,
    reserves: fo.reserves,
    recovery: fo.recoveries
  };
  const needYou = group(lists, r => r.status !== 'Requires amendment' && needsHandler(r.status, r));
  const withFin = group(lists, r => withFinance(r.status, r));
  const sentBack = group(lists, r => r.status === 'Requires amendment');
  return { total: needYou.total + withFin.total, needYou, withFinance: withFin, sentBack };
}
