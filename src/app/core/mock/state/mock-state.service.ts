import { Injectable, Injector, inject, signal, Signal } from '@angular/core';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { ClaimSection, SectionStatus, SectionBlockers } from '../../models/section.model';
import { Task, TaskStatus } from '../../models/task.model';
import { Claim } from '../../models/claim.model';
import { LossInformation } from '../../models/loss-information.model';
import { LossEventSummary } from '../../models/dashboard-extended.model';
import { CwbLocation } from '../../models/cwb-location.model';
import { Note } from '../../models/note.model';
import { MockScenario, MOCK_SCENARIOS } from '../mock-config';

export interface ScenarioOverrides {
  taskStatuses?:    Record<string, TaskStatus>;
  sectionStatuses?: Record<string, SectionStatus>;
  sectionBlockers?: Record<string, Partial<SectionBlockers>>;
  overviewPatch?:   { claimId: string; patch: Partial<ClaimOverview> };
  claimsAppend?:    Claim[];
  fnolStateOverride?: {
    selectedPolicy?: { policyId: string; policyNumber: string };
    selectedClient?: { clientId: string; clientName: string };
    path?:           'standard' | 'orphan' | null;
    // BMPCC-11006: prefill the happy-path FNOL form from a skeleton claim
    // so the demo can land on /fnol/search with every step's fields already
    // populated; user navigates through the wizard themselves. The skeleton
    // ID resolves against `skeleton-claims.json`.
    convertFromSkeletonId?: string;
    // Optional hint for the prefill: the policy number to drop into the
    // search form so the user only needs one click to find the right row.
    convertSuggestedPolicyNumber?: string;
  };
  cwbLocationsAppend?: CwbLocation[];
  notesAppend?: { claimId: string; notes: Note[] };
  paymentStatuses?: Record<string, 'Pending' | 'Processed' | 'Final'>;
}
import overviewData from '../data/claim-overview.json';
import activitiesData from '../data/claim-activities.json';
import sectionsData from '../data/sections.json';
import tasksData from '../data/tasks.json';
import claimsData from '../data/claims.json';
import lossInfoData from '../data/loss-information.json';
import lossEventsData from '../data/loss-events.json';

export interface MockState {
  overviews:        Record<string, ClaimOverview>;
  activities:       ClaimActivity[];
  sections:         ClaimSection[];
  tasks:            Task[];
  claims:           Claim[];
  lossInformation:  LossInformation[];
  lossEvents:       LossEventSummary[];
}

const STORAGE_KEY          = 'champ-mock-state';
const STORAGE_SCENARIO_KEY = 'champ-mock-scenario';
const STORAGE_VERSION_KEY  = 'champ-mock-version';
const STATE_VERSION        = 'ready-to-close-default-v4';

function defaultState(): MockState {
  return {
    overviews:       overviewData   as unknown as Record<string, ClaimOverview>,
    activities:      activitiesData as unknown as ClaimActivity[],
    sections:        sectionsData   as unknown as ClaimSection[],
    tasks:           tasksData      as unknown as Task[],
    claims:          claimsData     as unknown as Claim[],
    lossInformation: lossInfoData   as unknown as LossInformation[],
    lossEvents:      lossEventsData as unknown as LossEventSummary[],
  };
}

@Injectable({ providedIn: 'root' })
export class MockStateService {
  private readonly injector = inject(Injector);

  private readonly _state    = signal<MockState>(this.hydrateState());
  private readonly _scenario = signal<MockScenario>(this.hydrateScenario());

  readonly state:    Signal<MockState>    = this._state.asReadonly();
  readonly scenario: Signal<MockScenario> = this._scenario.asReadonly();

  patchOverview(claimId: string, partial: Partial<ClaimOverview>): void {
    const cur = this._state();
    const existing = cur.overviews[claimId];
    if (!existing) return;
    this._state.set({
      ...cur,
      overviews: { ...cur.overviews, [claimId]: { ...existing, ...partial } },
    });
    this.persist();
  }

  /**
   * Inserts an overview record for claimId only if one doesn't exist yet — idempotent.
   * Needed for claims that aren't in claim-overview.json yet (e.g. a skeleton/orphan
   * claim opened via Search before it's matched to a policy): patchOverview() above
   * refuses to write to a nonexistent key, so without this, edits to such a claim
   * silently no-op.
   */
  ensureOverview(claimId: string, overview: ClaimOverview): void {
    const cur = this._state();
    if (cur.overviews[claimId]) return;
    this._state.set({
      ...cur,
      overviews: { ...cur.overviews, [claimId]: overview },
    });
    this.persist();
  }

  patchSection(sectionId: string, partial: Partial<ClaimSection>): void {
    const cur = this._state();
    this._state.set({
      ...cur,
      sections: cur.sections.map(s => s.id === sectionId ? { ...s, ...partial } : s),
    });
    this.persist();
  }

  // Section creation primitive (Stage 3, FNOL/claim-file model fix) — writes
  // through the same signal + sessionStorage pipeline as every other mutation
  // here, so a created section survives reload the same way closure does.
  appendSections(sections: ClaimSection[]): void {
    const cur = this._state();
    this._state.set({ ...cur, sections: [...cur.sections, ...sections] });
    this.persist();
  }

  patchClaims(updater: (claims: Claim[]) => Claim[]): void {
    const cur = this._state();
    this._state.set({ ...cur, claims: updater(cur.claims) });
    this.persist();
  }

  patchTasks(updater: (tasks: Task[]) => Task[]): void {
    const cur = this._state();
    this._state.set({ ...cur, tasks: updater(cur.tasks) });
    this.persist();
  }

  patchActivities(updater: (items: ClaimActivity[]) => ClaimActivity[]): void {
    const cur = this._state();
    this._state.set({ ...cur, activities: updater(cur.activities) });
    this.persist();
  }

  patchLossInformation(updater: (items: LossInformation[]) => LossInformation[]): void {
    const cur = this._state();
    this._state.set({ ...cur, lossInformation: updater(cur.lossInformation) });
    this.persist();
  }

  patchLossEvent(lossEventId: string, partial: Partial<LossEventSummary>): void {
    const cur = this._state();
    this._state.set({
      ...cur,
      lossEvents: cur.lossEvents.map(e =>
        e.lossEventId === lossEventId ? { ...e, ...partial } : e
      ),
    });
    this.persist();
  }

  reset(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_SCENARIO_KEY);
    this._state.set(defaultState());
    this._scenario.set(MOCK_SCENARIOS['default']);
    // Lazy-resolve to avoid circular DI at construction time — both services are providedIn:root
    import('../services/mock-section.service').then(m =>
      this.injector.get(m.MockSectionService).resetCache()
    );
    import('../services/mock-cwb.service').then(m =>
      this.injector.get(m.MockCwbService).resetCache()
    );
    import('../services/mock-provider.service').then(m =>
      this.injector.get(m.MockProviderService).resetCache()
    );
    import('../services/mock-payments.service').then(m =>
      this.injector.get(m.MockPaymentsService).resetCache()
    );
  }

  async resetAsync(): Promise<void> {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_SCENARIO_KEY);
    this._state.set(defaultState());
    this._scenario.set(MOCK_SCENARIOS['default']);
    const sectionMod = await import('../services/mock-section.service');
    this.injector.get(sectionMod.MockSectionService).resetCache();
    const cwbMod = await import('../services/mock-cwb.service');
    this.injector.get(cwbMod.MockCwbService).resetCache();
    const providerMod = await import('../services/mock-provider.service');
    this.injector.get(providerMod.MockProviderService).resetCache();
    const paymentsMod = await import('../services/mock-payments.service');
    this.injector.get(paymentsMod.MockPaymentsService).resetCache();
  }

  loadScenario(name: string): void {
    const scenario = MOCK_SCENARIOS[name];
    if (!scenario) return;
    this._scenario.set(scenario);
    sessionStorage.setItem(STORAGE_SCENARIO_KEY, name);
  }

  loadStatePreset(overrides: ScenarioOverrides): void {
    const cur = this._state();
    let next = { ...cur };

    if (overrides.taskStatuses) {
      const map = overrides.taskStatuses;
      next = { ...next, tasks: next.tasks.map(t => map[t.taskId] ? { ...t, status: map[t.taskId] } : t) };
    }

    if (overrides.sectionStatuses) {
      const map = overrides.sectionStatuses;
      next = { ...next, sections: next.sections.map(s => map[s.id] ? { ...s, status: map[s.id] } : s) };
    }

    if (overrides.sectionBlockers) {
      const map = overrides.sectionBlockers;
      next = { ...next, sections: next.sections.map(s => map[s.id] ? { ...s, ...map[s.id] } : s) };
    }

    if (overrides.overviewPatch) {
      const { claimId, patch } = overrides.overviewPatch;
      const existing = next.overviews[claimId];
      if (existing) {
        next = { ...next, overviews: { ...next.overviews, [claimId]: { ...existing, ...patch } } };
      }
    }

    if (overrides.claimsAppend?.length) {
      const incoming = overrides.claimsAppend;
      const existingIds = new Set(next.claims.map(c => c.claimId));
      const fresh = incoming.filter(c => !existingIds.has(c.claimId));
      next = { ...next, claims: [...next.claims, ...fresh] };
    }

    if (overrides.cwbLocationsAppend?.length) {
      const rows = overrides.cwbLocationsAppend;
      import('../services/mock-cwb.service').then(m =>
        this.injector.get(m.MockCwbService).appendLocations(rows)
      );
    }

    if (overrides.notesAppend) {
      const { claimId, notes } = overrides.notesAppend;
      import('../services/mock-notes.service').then(m =>
        this.injector.get(m.MockNotesService).appendNotes(claimId, notes)
      );
    }

    if (overrides.paymentStatuses) {
      const statuses = overrides.paymentStatuses;
      import('../services/mock-payments.service').then(m =>
        this.injector.get(m.MockPaymentsService).patchStatus(statuses)
      );
    }

    this._state.set(next);
    this.persist();
  }

  private hydrateState(): MockState {
    try {
      const version = sessionStorage.getItem(STORAGE_VERSION_KEY);
      if (version !== STATE_VERSION) {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_SCENARIO_KEY);
        sessionStorage.setItem(STORAGE_VERSION_KEY, STATE_VERSION);
        return defaultState();
      }
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as MockState;
    } catch {
      // corrupt storage — fall through to default
    }
    return defaultState();
  }

  private hydrateScenario(): MockScenario {
    try {
      const name = sessionStorage.getItem(STORAGE_SCENARIO_KEY);
      if (name && MOCK_SCENARIOS[name]) return MOCK_SCENARIOS[name];
    } catch {
      // fall through
    }
    return MOCK_SCENARIOS['default'];
  }

  private persist(): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._state()));
    } catch {
      // sessionStorage unavailable (SSR / private browsing quota)
    }
  }
}
