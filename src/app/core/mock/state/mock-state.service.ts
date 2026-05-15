import { Injectable, Injector, inject, signal, Signal } from '@angular/core';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { ClaimSection, SectionStatus } from '../../models/section.model';
import { Task, TaskStatus } from '../../models/task.model';
import { Claim } from '../../models/claim.model';
import { LossInformation } from '../../models/loss-information.model';
import { MockScenario, MOCK_SCENARIOS } from '../mock-config';

export interface ScenarioOverrides {
  taskStatuses?:    Record<string, TaskStatus>;
  sectionStatuses?: Record<string, SectionStatus>;
  overviewPatch?:   { claimId: string; patch: Partial<ClaimOverview> };
}
import overviewData from '../data/claim-overview.json';
import activitiesData from '../data/claim-activities.json';
import sectionsData from '../data/sections.json';
import tasksData from '../data/tasks.json';
import claimsData from '../data/claims.json';
import lossInfoData from '../data/loss-information.json';

export interface MockState {
  overviews:        Record<string, ClaimOverview>;
  activities:       ClaimActivity[];
  sections:         ClaimSection[];
  tasks:            Task[];
  claims:           Claim[];
  lossInformation:  LossInformation[];
}

const STORAGE_KEY          = 'champ-mock-state';
const STORAGE_SCENARIO_KEY = 'champ-mock-scenario';

function defaultState(): MockState {
  return {
    overviews:       overviewData   as unknown as Record<string, ClaimOverview>,
    activities:      activitiesData as unknown as ClaimActivity[],
    sections:        sectionsData   as unknown as ClaimSection[],
    tasks:           tasksData      as unknown as Task[],
    claims:          claimsData     as unknown as Claim[],
    lossInformation: lossInfoData   as unknown as LossInformation[],
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

  patchSection(sectionId: string, partial: Partial<ClaimSection>): void {
    const cur = this._state();
    this._state.set({
      ...cur,
      sections: cur.sections.map(s => s.id === sectionId ? { ...s, ...partial } : s),
    });
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

  patchLossInformation(updater: (items: LossInformation[]) => LossInformation[]): void {
    const cur = this._state();
    this._state.set({ ...cur, lossInformation: updater(cur.lossInformation) });
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
  }

  async resetAsync(): Promise<void> {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_SCENARIO_KEY);
    this._state.set(defaultState());
    this._scenario.set(MOCK_SCENARIOS['default']);
    const m = await import('../services/mock-section.service');
    this.injector.get(m.MockSectionService).resetCache();
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

    if (overrides.overviewPatch) {
      const { claimId, patch } = overrides.overviewPatch;
      const existing = next.overviews[claimId];
      if (existing) {
        next = { ...next, overviews: { ...next.overviews, [claimId]: { ...existing, ...patch } } };
      }
    }

    this._state.set(next);
    this.persist();
  }

  private hydrateState(): MockState {
    try {
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
