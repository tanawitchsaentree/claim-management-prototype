// Global Genius on the handler dashboard (docs/ux/gg-dashboard.md). Base: a
// colleague's Figma design (claims portfolio triangle + popover, Claim
// Overview banner), with 4 changes agreed on 2026-11-18.
//
// DESIGN DECISION GG-DASH-2 (replaces GG-DASH-1, the separate "needs your
// action" list):
// - A red triangle after the Claim ID in the Claims portfolio marks a claim
//   with a GG problem. It opens a popover that says what broke, per item, with
//   the action that fits the cause (change 2).
// - Status reads "Failed" only when the claim itself couldn't be set up in GG.
//   A failed payment / reserve / recovery / section leaves it Open (change 1).
// - Claims with a GG problem sort to the top, and a "Global Genius issues: N"
//   chip shows only those, so none hide past row 5 (change 3).
// - While GG is down, items that failed because GG was unavailable get no
//   triangle: the downtime banner counts them (change 4).

/** Planned or ongoing GG downtime. Absent = GG is up and nothing is planned. */
export type GgDowntime =
  // Days before a planned window: date + time range.
  | { phase: 'planned'; inDays: number; from: string; to: string }
  // GG is unavailable now (unplanned, or inside the planned window).
  | { phase: 'during' };

/** What the handler can do about one broken item, from the popover. */
export type GgProblemAction =
  // GG was unavailable and the automatic retries ran out: send the same item
  // again, with the same confirm step as the Payments list. `summary` names the
  // item in that step ("Payment to Dirk Haas").
  | { kind: 'retry-item'; item: 'payment' | 'reserve' | 'recovery'; id: string; summary: string }
  // Data the handler must fix (bank details, party...), or a section to retry on Claim Overview.
  | { kind: 'link'; label: string; link: string[]; queryParams?: Record<string, string> }
  // Finance owns the fix.
  | { kind: 'none' };

/** One broken item on a claim, as one line in the popover. */
export interface GgProblemLine {
  key: string;
  // What broke, in plain words: "Payment to Dirk Haas not booked: ...".
  text: string;
  action: GgProblemAction;
}

/** Everything wrong with one claim in GG. No entry = nothing wrong. */
export interface GgClaimProblem {
  claimId: string;
  // The claim itself couldn't be set up in GG: status reads "Failed".
  setupFailed: boolean;
  // GG's root cause for the set-up failure, without the closing full stop.
  rootCause?: string;
  // Retried twice and still failed: Finance has it, no Retry.
  setupWithFinance: boolean;
  lines: GgProblemLine[];
}

/** What the downtime banner shows. Null = no banner. */
export type GgDowntimeBanner =
  | { phase: 'planned'; date: string; from: string; to: string }
  | { phase: 'during'; waiting: number };
