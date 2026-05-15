import { Injectable, inject, isDevMode, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { filter, map, startWith, catchError } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService, ScenarioOverrides } from '../../../core/mock/state/mock-state.service';
import { DevToolStorageService } from '../../../core/storage/dev-tool-storage.service';

export interface PreconditionItem {
  text:  string;
  page:  'overview' | 'sections' | 'any';
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
  page:           'overview' | 'sections' | 'any';
  buildStatus:    BuildStatus;
  setup: {
    description:    string;
    preconditions:  Array<string | PreconditionItem>;
    stateOverrides: ScenarioOverrides;
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
  module:              string;
  title:               string;
  targetClaim:         string;
  pages:               Array<'overview' | 'sections' | 'any'>;
  walkthroughSteps:    string[];
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
  private readonly stateSvc  = inject(MockStateService);
  private readonly http      = inject(HttpClient);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly router    = inject(Router);
  private readonly storage   = inject(DevToolStorageService);

  readonly enabled = isDevMode();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  private readonly isClaimRoute = computed(() =>
    /^\/claims\/[^/]+\/.+/.test(this.url()),
  );

  readonly shouldShowBanner = computed(() => isDevMode() && this.isClaimRoute());

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
    const index = await firstValueFrom(
      this.http.get<TicketIndex>('/tickets/index.json').pipe(catchError(() => of(null))),
    );
    if (!index) return;

    const loaded = await Promise.all(
      index.tickets.map(entry =>
        firstValueFrom(
          this.http.get<DevTicket>(`/tickets/${entry.file}`).pipe(catchError(() => of(null))),
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
    const cards = this.availableCards();
    for (const card of cards) {
      const ac = card.ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) {
        await this.stateSvc.resetAsync();
        this.stateSvc.loadStatePreset(ac.setup.stateOverrides);
        this.activeAcId.set(acId);
        return;
      }
    }
  }

  clearActiveAc(): void { this.activeAcId.set(null); }

  setMinimized(acId: string): void { this._minimizedAcId.set(acId); }
  clearMinimized(): void { this._minimizedAcId.set(null); }

  pageRoute(page: 'overview' | 'sections', claimId: string): string {
    return `/claims/${claimId}/${page}`;
  }

  applyScenario(overrides: ScenarioOverrides): void {
    if (!this.enabled) return;
    this.stateSvc.reset();
    this.stateSvc.loadStatePreset(overrides);
    this.activeAcId.set(null);
  }
}
