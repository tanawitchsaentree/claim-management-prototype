import { PostLandHook } from '../scenario/scenario-stage.model';
import { ScenarioOverrides } from '../mock/state/mock-state.service';
import { TourStep } from '../services/tour.service';

// Shape of public/tickets/*.json — the prototype's own review-ticket
// registry (Jira-style ticket + AC/scenario data, not the Jira-synced
// tracker's `ticket` table). Moved here from
// features/claims/dev-banner/claim-dev-helper.service.ts (2026-08-20) so
// core/services/prototype-scenario.service.ts can load/apply these tickets
// too, without core depending on a features/ file.
export type PreconditionPage = 'overview' | 'sections' | 'fnol-search' | 'fnol-loss-info' | 'fnol-entities-damages' | 'fnol-skeleton' | 'fnol-skeleton-parties' | 'fnol-skeleton-location' | 'fnol-summary' | 'any';

export interface PreconditionItem {
  text:  string;
  page:  PreconditionPage;
  role:  'tested-visible' | 'setup' | 'metadata';
  hint?: string;
}

export type BuildStatus = 'done' | 'partial' | 'todo';

export interface TicketAC {
  id:             string;
  statement:      string;
  plainStatement?: string;
  page:           PreconditionPage;
  buildStatus:    BuildStatus;
  /**
   * Claim this AC is asserted against, when it differs from the ticket's
   * `targetClaim` (2026-09-01, BMPCC-17779 phase B). A ticket about a
   * claim-level state machine has to describe several states at once, and one
   * seeded claim cannot be in all of them — the recovery ACs run across
   * CLM-2024-001 (No), CLM-2024-024 (Yes, no case) and CLM-2024-003 (Yes,
   * case running). Read by audit-ac-logic.mjs and by the dev banner's state
   * inspector; unset means "use the ticket's targetClaim".
   */
  targetClaim?:   string;
  setup: {
    description:    string;
    preconditions:  Array<string | PreconditionItem>;
    stateOverrides: ScenarioOverrides;
    postLand?:      PostLandHook[];
  };
  expectedUI: {
    description: string;
    visualCues:  string[];
  };
  howToTest: {
    route:          string;
    trigger:        string;
    expectedResult: string;
  };
  expectedOutcome?: {
    pendingTasks?:    number;
    doneTasks?:       number;
    openSections?:    number;
    closedSections?:  number;
    overviewStatus?:  string;
    canClose?:        boolean;
    buttonVisible?:   boolean;
    buttonEnabled?:   boolean;
    tooltipContains?: string;
    closedByName?:    string;
    closureReason?:   string;
    taskStatuses?:    Record<string, string>;
    sectionStatuses?: Record<string, string>;
    // BMPCC-17779 — the recovery-potential decision and the state derived from
    // it, plus how many recovery cases the recovery domain holds for the claim.
    recoveryPotential?:       'yes' | 'no' | null;
    recoveryPotentialState?:  'unanswered' | 'yes-pending' | 'yes-active' | 'yes-settled' | 'no';
    recoveryCasesCount?:      number;
    openRecoveryCasesCount?:  number;
  };
}

export interface DevTicket {
  ticketId:            string;
  /** Parent Jira epic ID, when a confirmed mapping exists — do not guess, leave unset otherwise. */
  epicId?:             string;
  module:              string;
  title:               string;
  targetClaim:         string;
  pages:               PreconditionPage[];
  // Extended (2026-08-20, tour-system audit) to optionally carry structured
  // TourStep objects alongside the original plain-text narrative — a
  // TourStep entry (has `targetId`) becomes a tour step; a string entry
  // stays prose-only.
  walkthroughSteps:    Array<string | TourStep>;
  acceptanceCriteria:  TicketAC[];
}

export interface TicketIndexEntry {
  id:     string;
  file:   string;
  module: string;
  title:  string;
}

export interface TicketIndex {
  tickets: TicketIndexEntry[];
}
