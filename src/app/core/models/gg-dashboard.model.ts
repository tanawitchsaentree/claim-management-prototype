// Global Genius on the handler dashboard (docs/ux/gg-dashboard.md, review call
// questions from James and the PO / BO answers, email 2026-11-18).
//
// DESIGN DECISION GG-DASH-1: one row per broken item, not per claim, so every
// row links straight to its own fix (critique 4). Only items the handler can
// fix are listed: Finance-owned failures stay off the list (critique 6), and
// items that failed because GG was unavailable are never red rows, they are
// counted in the downtime banner instead (critique 1). The list shows the
// first 5 rows and "Show N more", the dashboard's own pattern, no pagination
// (critique 2).

/** Planned or ongoing GG downtime. Absent = GG is up and nothing is planned. */
export type GgDowntime =
  // Days before a planned window: date + time range.
  | { phase: 'planned'; inDays: number; from: string; to: string }
  // GG is unavailable now (unplanned, or inside the planned window).
  | { phase: 'during' };

/** One broken item the handler has to fix, for the dashboard list. */
export interface GgAttentionItem {
  // Unique per item (payment / reserve / recovery / section / claim id).
  key: string;
  claimId: string;
  clientName: string;
  // What broke + plain reason, e.g. "Payment to Dirk Haas not booked: ...".
  reason: string;
  // Says where the link goes: "Fix payment", "Retry on claim".
  linkLabel: string;
  link: string[];
  queryParams?: Record<string, string>;
}

/** What the downtime banner shows. Null = no banner. */
export type GgDowntimeBanner =
  | { phase: 'planned'; date: string; from: string; to: string }
  | { phase: 'during'; waiting: number };
