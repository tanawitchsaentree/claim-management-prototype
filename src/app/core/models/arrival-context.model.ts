import { BlockedReason, TrackerStageStatus } from './tracker.model';
import { BuildStatus } from './dev-ticket.model';

// What a reviewer needs to know the moment a tracker link drops them onto a
// screen. Everything here is DERIVED — from the linked public/tickets/*.json
// ticket and/or the tracker row itself — never authored per ticket. There is no
// "orientation text" field anywhere and there must not be one: the acceptance
// criteria already say what to look at, and a second hand-written copy of that
// would go stale the first time an AC changed.
//
// See arrival-context.builder.ts for the derivation and the empty cases.

export interface ArrivalCriterion {
  id: string;
  statement: string;
  buildStatus: BuildStatus;
  /** expectedUI.description — what the screen should show. */
  expected: string;
  visualCues: string[];
  /** howToTest.trigger — the thing to actually do. */
  trigger: string;
  expectedResult: string;
}

export interface ArrivalContext {
  /** Tracker Jira key, when the link came from a tracker row. */
  jiraKey: string | null;
  jiraUrl: string | null;
  /** public/tickets/*.json id (DevTicket.ticketId), when one is linked. */
  ticketId: string | null;
  title: string;
  module: string | null;
  route: string;
  buildStatus: TrackerStageStatus | null;
  handoffStatus: TrackerStageStatus | null;
  blockedBy: BlockedReason | null;
  blockedNote: string | null;
  criteria: ArrivalCriterion[];
  /** 0 means no tour is available — the panel must not offer one. */
  tourStepCount: number;
  /**
   * True when the tour steps were generated from the ACs rather than authored as
   * walkthroughSteps. Surfaced to the reviewer, who should know whether they're
   * reading someone's narrative or a machine paraphrase of the criteria.
   */
  tourIsGenerated: boolean;
}
