import { FinancialOverview } from '../../../core/models/financial-overview.model';
import { Bookable, statusExplanation } from '../../../core/models/gg-booking.model';

export type FinancialListView = 'payments' | 'reserves' | 'recovery';
type Who = 'you' | 'finance';

export interface NotBookedLink {
  view: FinancialListView;
  text: string;
}

export interface NotBookedGroup {
  who: Who;
  total: number;
  links: NotBookedLink[];
}

// singular, plural
const WORDS: Record<FinancialListView, [string, string]> = {
  payments: ['payment', 'payments'],
  reserves: ['reserve', 'reserves'],
  recovery: ['recovery', 'recoveries']
};

const NOUN: Record<FinancialListView, 'payment' | 'reserve' | 'recovery'> = {
  payments: 'payment',
  reserves: 'reserve',
  recovery: 'recovery'
};

/** Who the row waits for, or null when it needs nobody ("you" also covers an approver send-back). */
export function waitsFor(
  view: FinancialListView,
  approvalStatus: string,
  item: Bookable
): string | null {
  return statusExplanation(approvalStatus, item, NOUN[view])?.whoActs ?? null;
}

/** How many rows on one list wait for the handler (the "Needs you" count). */
export function needsYouCount(
  view: FinancialListView,
  rows: (Bookable & { status: string })[]
): number {
  return rows.filter(r => waitsFor(view, r.status, r) === 'you').length;
}

/**
 * Items Global Genius couldn't book, split by who has to act. Only
 * "Couldn't be booked" rows count here, not approver send-backs.
 */
export function notBookedGroups(fo: FinancialOverview): NotBookedGroup[] {
  const lists: Record<FinancialListView, (Bookable & { status: string })[]> = {
    payments: fo.payments,
    reserves: fo.reserves,
    recovery: fo.recoveries
  };
  const groups: NotBookedGroup[] = [];
  for (const who of ['you', 'finance'] as Who[]) {
    const links: NotBookedLink[] = [];
    let total = 0;
    for (const view of Object.keys(lists) as FinancialListView[]) {
      const n = lists[view].filter(
        r => r.bookingStatus === 'needs-fixing' && waitsFor(view, r.status, r) === who
      ).length;
      if (n > 0) {
        total += n;
        links.push({ view, text: `${n} ${WORDS[view][n === 1 ? 0 : 1]}` });
      }
    }
    if (total > 0) groups.push({ who, total, links });
  }
  return groups;
}

/** Scroll a list row (tagged data-row-id) into the middle of the page, once the list has rendered. */
export function scrollToRow(id: string): void {
  setTimeout(() => {
    const row = Array.from(document.querySelectorAll('[data-row-id]')).find(
      el => el.getAttribute('data-row-id') === id
    );
    row?.scrollIntoView({ block: 'center' });
  }, 200);
}
