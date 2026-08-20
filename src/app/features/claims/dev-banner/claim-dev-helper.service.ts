import { Injectable, inject, isDevMode, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { filter, map, startWith, catchError } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService, ScenarioOverrides } from '../../../core/mock/state/mock-state.service';
import { DevToolStorageService } from '../../../core/storage/dev-tool-storage.service';
import { FnolStateService } from '../../fnol/services/fnol-state.service';
import { ScenarioStageService } from '../../../core/scenario/scenario-stage.service';
import { PostLandHook } from '../../../core/scenario/scenario-stage.model';
import { MockSkeletonClaimService } from '../../../core/mock/services/mock-skeleton-claim.service';
import { MockPolicyLocationService } from '../../../core/mock/services/mock-policy-location.service';
import { LocationItem } from '../../../core/models';
import { TourStep } from '../../../core/services/tour.service';

export type PreconditionPage = 'overview' | 'sections' | 'fnol-search' | 'fnol-loss-info' | 'fnol-entities-damages' | 'fnol-skeleton' | 'fnol-skeleton-parties' | 'fnol-skeleton-location' | 'fnol-summary' | 'any';

export interface PreconditionItem {
  text:  string;
  page:  PreconditionPage;
  role:  'tested-visible' | 'setup' | 'metadata';
  hint?: string;
}

export type BuildStatus = 'done' | 'partial' | 'todo';

export interface ACVerification {
  acId:       string;
  verifiedBy: string;
  verifiedAt: string;
}

export interface TicketAC {
  id:             string;
  statement:      string;
  plainStatement?: string;
  page:           PreconditionPage;
  buildStatus:    BuildStatus;
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
  // TourStep objects alongside the original plain-text narrative — nothing
  // ever rendered this field before, so old plain-string tickets are
  // untouched and new tickets can mix both freely. A TourStep entry (has
  // `targetId`) becomes a tour step; a string entry stays prose-only.
  walkthroughSteps:    Array<string | TourStep>;
  acceptanceCriteria:  TicketAC[];
}

/** @deprecated use DevTicket */
export type ClosureTicket = DevTicket;

export interface TicketCard {
  id:            string;
  title:         string;
  acCount:       number;
  scenarioCount: number;
  status:        'done' | 'wip' | 'todo';
  ticket:        DevTicket;
}

interface TicketIndexEntry {
  id:     string;
  file:   string;
  module: string;
  title:  string;
}

interface TicketIndex {
  tickets: TicketIndexEntry[];
}

@Injectable({ providedIn: 'root' })
export class ClaimDevHelperService {
  private readonly stateSvc    = inject(MockStateService);
  private readonly fnolStateSvc = inject(FnolStateService);
  private readonly skeletonSvc = inject(MockSkeletonClaimService);
  private readonly policyLocationSvc = inject(MockPolicyLocationService);
  private readonly stageSvc    = inject(ScenarioStageService);
  private readonly http        = inject(HttpClient);
  private readonly dialogSvc   = inject(NxDialogService);
  private readonly router      = inject(Router);
  private readonly storage     = inject(DevToolStorageService);

  readonly enabled = true;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly isFeatureRoute = computed(() =>
    /^\/(claims\/[^/]+|fnol)\/.+/.test(this.url()),
  );

  private readonly isFnolRoute = computed(() =>
    /^\/fnol\//.test(this.url()),
  );

  readonly shouldShowBanner = computed(() => this.isFeatureRoute());
  readonly shouldShowFnolHelper = computed(() => this.isFnolRoute());
  readonly isOverviewRoute = computed(() => /^\/claims\/[^/]+\/overview/.test(this.url()));

  private readonly _tickets = signal<DevTicket[]>([]);
  readonly tickets = this._tickets.asReadonly();

  private readonly _selectedTicketId = signal<string | null>(null);

  readonly selectedTicket = computed<DevTicket | null>(() => {
    const id = this._selectedTicketId();
    return this._tickets().find(t => t.ticketId === id) ?? null;
  });

  selectTicket(id: string | null): void { this._selectedTicketId.set(id); }

  /** Backward-compat: TicketCard array derived from loaded tickets. */
  readonly availableCards = computed<TicketCard[]>(() =>
    this._tickets().map(ticket => {
      const doneCount = ticket.acceptanceCriteria.filter(a => a.buildStatus === 'done').length;
      return {
        id:            ticket.ticketId,
        title:         ticket.title,
        acCount:       ticket.acceptanceCriteria.length,
        scenarioCount: doneCount,
        status:        doneCount === ticket.acceptanceCriteria.length ? 'done' : 'wip',
        ticket,
      } satisfies TicketCard;
    })
  );

  private readonly _verifications = signal<Map<string, ACVerification>>(
    this.storage.loadVerifications(),
  );
  readonly verifications = this._verifications.asReadonly();

  private readonly _verifierName = signal<string | null>(
    this.storage.loadVerifierName(),
  );
  readonly verifierName = this._verifierName.asReadonly();

  setVerifierName(name: string): void {
    const trimmed = name.trim() || null;
    this._verifierName.set(trimmed);
    if (trimmed) this.storage.saveVerifierName(trimmed);
    else this.storage.clearVerifierName();
  }

  private verificationKey(ticketId: string, acId: string): string {
    return `${ticketId}::${acId}`;
  }

  markVerified(ticketId: string, acId: string, by: string): void {
    const key = this.verificationKey(ticketId, acId);
    const v: ACVerification = { acId, verifiedBy: by, verifiedAt: new Date().toISOString() };
    this._verifications.update(m => new Map(m).set(key, v));
    this.storage.saveVerifications(this._verifications());
  }

  unmarkVerified(ticketId: string, acId: string): void {
    const key = this.verificationKey(ticketId, acId);
    this._verifications.update(m => { const n = new Map(m); n.delete(key); return n; });
    this.storage.saveVerifications(this._verifications());
  }

  getVerification(ticketId: string, acId: string): ACVerification | undefined {
    return this._verifications().get(this.verificationKey(ticketId, acId));
  }

  isVerified(ticketId: string, acId: string): boolean {
    return this._verifications().has(this.verificationKey(ticketId, acId));
  }

  readonly activeAcId = signal<string | null>(null);

  private readonly _minimizedAcId = signal<string | null>(null);
  readonly minimizedAcId = this._minimizedAcId.asReadonly();

  readonly currentClaimId = computed(() => {
    const match = this.url().match(/^\/claims\/([^/]+)\//);
    return match?.[1] ?? null;
  });

  loadTickets(): void {
    if (!this.enabled) return;
    this.loadAllTickets().catch(() => {/* silent: dev tool only */});
  }

  private async loadAllTickets(): Promise<void> {
    const base = document.baseURI;
    const bust = `?t=${Date.now()}`;
    const index = await firstValueFrom(
      this.http.get<TicketIndex>(`${base}tickets/index.json${bust}`).pipe(catchError(() => of(null))),
    );
    if (!index) return;

    const loaded = await Promise.all(
      index.tickets.map(entry =>
        firstValueFrom(
          this.http.get<DevTicket>(`${base}tickets/${entry.file}${bust}`).pipe(catchError(() => of(null))),
        ),
      ),
    );

    this._tickets.set(loaded.filter((t): t is DevTicket => t !== null));
  }

  openDetailsFor(card: TicketCard, preselectedAcId?: string | null): void {
    if (!this.enabled) return;
    import('./details-modal/claim-dev-details-modal.component').then(m => {
      this.dialogSvc.open(m.ClaimDevDetailsModalComponent, {
        data: { card, helper: this, preselectedAcId: preselectedAcId ?? null },
        width: '800px',
      });
    });
  }

  async applyAC(acId: string): Promise<void> {
    if (!this.enabled) return;
    // Search the currently-selected ticket first (so AC-02 in BMPCC-216 doesn't
    // collide with AC-02 in CHAMP-CLOSURE-001). Fall back to scanning all
    // tickets if no ticket is selected.
    const selected = this.selectedTicket();
    const orderedTickets: DevTicket[] = selected
      ? [selected, ...this._tickets().filter(t => t.ticketId !== selected.ticketId)]
      : this._tickets();
    for (const ticket of orderedTickets) {
      const ac = ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) {
        await this.stateSvc.resetAsync();
        this.stateSvc.loadStatePreset(ac.setup.stateOverrides);
        await this.applyFnolStateOverride(ac.setup.stateOverrides);
        await new Promise(resolve => setTimeout(resolve, 0));
        this.activeAcId.set(acId);
        return;
      }
    }
  }

  async runPostLandFor(acId: string): Promise<void> {
    if (!this.enabled) return;
    const selected = this.selectedTicket();
    const orderedTickets: DevTicket[] = selected
      ? [selected, ...this._tickets().filter(t => t.ticketId !== selected.ticketId)]
      : this._tickets();
    for (const ticket of orderedTickets) {
      const ac = ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) {
        const declaredHooks = ac.setup.postLand ?? [];
        // Only fall back to the ticket's tour when this AC has no postLand
        // of its own — e.g. CHAMP-READY-CLOSE's AC-02 already auto-opens
        // the closure modal via 'overview.openClosureModal'; bolting a tour
        // onto that too would fight the modal for the same screen space.
        const hooks = declaredHooks.length > 0 ? declaredHooks : this.tourHooksFor(ticket);
        await this.stageSvc.run(hooks, this.currentClaimId() ?? undefined);
        return;
      }
    }
  }

  private tourHooksFor(ticket: DevTicket): TicketAC['setup']['postLand'] {
    const steps = ticket.walkthroughSteps.filter((s): s is TourStep => typeof s !== 'string');
    return steps.length > 0 ? [{ kind: 'tour.start', steps }] : [];
  }

  private async applyFnolStateOverride(overrides: ScenarioOverrides): Promise<void> {
    const seed = overrides.fnolStateOverride;
    if (!seed) return;
    this.fnolStateSvc.reset();
    if (seed.selectedClient) this.fnolStateSvc.setSelectedClient(seed.selectedClient);
    if (seed.selectedPolicy) this.fnolStateSvc.setSelectedPolicy(seed.selectedPolicy);
    if (seed.path !== undefined) this.fnolStateSvc.path = seed.path;
    if (seed.convertFromSkeletonId) {
      const skeleton = await firstValueFrom(
        this.skeletonSvc.getById(seed.convertFromSkeletonId).pipe(catchError(() => of(null))),
      );
      if (skeleton) {
        const policyNumber = seed.convertSuggestedPolicyNumber;
        // Resolve the real policy location so loss-info gets a backed
        // PolicyLocation (no hardcoded Munich address). Only the first
        // active location is used; user can edit/replace in the UI.
        let location: LocationItem | undefined;
        if (policyNumber) {
          const locs = await firstValueFrom(
            this.policyLocationSvc.getByPolicyNumber(policyNumber).pipe(catchError(() => of([]))),
          );
          const active = locs.find(l => l.active) ?? locs[0];
          if (active) {
            location = {
              id:                active.id,
              source:            'policy',
              displayName:       active.name,
              addressLine1:      active.addressLine1,
              postalCode:        active.postalCode,
              city:              active.city,
              country:           active.country,
              propertyId:        active.propertyId,
              policyLocationRef: active.id,
            };
          }
        }
        this.fnolStateSvc.prefillFullFromSkeleton(skeleton, { policyNumber, location });
        // Fire the dev-fill bridge that auto-runs Search and pre-selects the
        // matching policy row. Delayed 250ms because Step1SearchComponent
        // subscribes inside its ngOnInit — the Subject has to fire AFTER the
        // router has placed the component in the tree.
        if (policyNumber) {
          setTimeout(() => {
            this.fnolStateSvc.devSearchFill$.next({
              policyNumber,
              clientName: skeleton.clientName ?? '',
            });
          }, 250);
        }
      }
    }
  }

  clearActiveAc(): void { this.activeAcId.set(null); }

  setMinimized(acId: string): void { this._minimizedAcId.set(acId); }
  clearMinimized(): void { this._minimizedAcId.set(null); }

  pageRoute(page: PreconditionPage, claimId: string): string {
    if (page === 'fnol-search')             return '/fnol/search';
    if (page === 'fnol-loss-info')          return '/fnol/loss-information';
    if (page === 'fnol-entities-damages')   return '/fnol/entities-damages';
    if (page === 'fnol-skeleton')           return '/fnol/skeleton-create';
    if (page === 'fnol-skeleton-parties')   return '/fnol/skeleton-parties';
    if (page === 'fnol-skeleton-location')  return '/fnol/skeleton-location';
    if (page === 'fnol-summary')            return '/fnol/summary';
    if (page === 'any') return '';
    return `/claims/${claimId}/${page}`;
  }

  applyScenario(overrides: ScenarioOverrides): void {
    if (!this.enabled) return;
    this.stateSvc.reset();
    this.stateSvc.loadStatePreset(overrides);
    this.activeAcId.set(null);
  }
}
