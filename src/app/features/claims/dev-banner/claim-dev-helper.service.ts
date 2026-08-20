import { Injectable, inject, isDevMode, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService, ScenarioOverrides } from '../../../core/mock/state/mock-state.service';
import { DevToolStorageService } from '../../../core/storage/dev-tool-storage.service';
import { ScenarioStageService } from '../../../core/scenario/scenario-stage.service';
import { PostLandHook } from '../../../core/scenario/scenario-stage.model';
import { PrototypeScenarioService } from '../../../core/services/prototype-scenario.service';
import { TourStep } from '../../../core/services/tour.service';
import {
  BuildStatus,
  DevTicket,
  PreconditionPage,
  PreconditionItem,
  TicketAC,
  TicketIndex,
} from '../../../core/models/dev-ticket.model';

export type { PreconditionPage, PreconditionItem, BuildStatus, TicketAC, DevTicket };

export interface ACVerification {
  acId:       string;
  verifiedBy: string;
  verifiedAt: string;
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

@Injectable({ providedIn: 'root' })
export class ClaimDevHelperService {
  private readonly stateSvc    = inject(MockStateService);
  private readonly prototypeScenarioSvc = inject(PrototypeScenarioService);
  private readonly stageSvc    = inject(ScenarioStageService);
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

  // Ticket registry itself lives in PrototypeScenarioService now (core/),
  // shared with the tracker bridge — this stays a thin readonly alias.
  readonly tickets = this.prototypeScenarioSvc.tickets;

  private readonly _selectedTicketId = signal<string | null>(null);

  readonly selectedTicket = computed<DevTicket | null>(() => {
    const id = this._selectedTicketId();
    return this.tickets().find(t => t.ticketId === id) ?? null;
  });

  selectTicket(id: string | null): void { this._selectedTicketId.set(id); }

  /** Backward-compat: TicketCard array derived from loaded tickets. */
  readonly availableCards = computed<TicketCard[]>(() =>
    this.tickets().map(ticket => {
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
    this.prototypeScenarioSvc.loadTickets().catch(() => {/* silent: dev tool only */});
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
      ? [selected, ...this.tickets().filter(t => t.ticketId !== selected.ticketId)]
      : this.tickets();
    for (const ticket of orderedTickets) {
      const ac = ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) {
        await this.prototypeScenarioSvc.applyOverrides(ac.setup.stateOverrides);
        this.activeAcId.set(acId);
        return;
      }
    }
  }

  async runPostLandFor(acId: string): Promise<void> {
    if (!this.enabled) return;
    const selected = this.selectedTicket();
    const orderedTickets: DevTicket[] = selected
      ? [selected, ...this.tickets().filter(t => t.ticketId !== selected.ticketId)]
      : this.tickets();
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
