import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { MockRecoveryService } from '../../../core/mock/services/mock-recovery.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { ClaimOverview } from '../../../core/models/claim-overview.model';
import { RecoveryCase, RecoveryCaseStatus, isRecoveryOpen } from '../../../core/models/recovery.model';
import {
  RECOVERY_STATE_MESSAGE,
  RecoveryPotentialState,
  recoveryPotentialState,
} from '../../../core/models/recovery-potential.model';
import {
  CreateRecoveryModalComponent,
  CreateRecoveryModalData,
  CreateRecoveryModalResult,
} from './components/create-recovery-modal/create-recovery-modal.component';
import {
  ResolveRecoveryModalComponent,
  ResolveRecoveryModalData,
  ResolveRecoveryModalResult,
} from './components/resolve-recovery-modal/resolve-recovery-modal.component';

// Same shape litigation uses — map the domain status onto an existing chip
// token rather than adding a new status-chip domain for four values.
const STATUS_CHIP_MAP: Record<RecoveryCaseStatus, string> = {
  'Draft':       'open',
  'In progress': 'in-progress',
  'Recovered':   'bound',
  'Written off': 'closed',
};

interface RecoveryGuidance {
  context: 'warning' | 'info';
  message: string;
  showOverviewLink: boolean;
}

/**
 * The recovery domain — BMPCC-17779 phase B (Recoveries call, 2026-09-01).
 *
 * `/claims/:id/recoveries` was a redirect stub, so the "Set up recovery case"
 * link on the Overview card bounced the handler straight back to Overview. The
 * feedback was explicit that answering "Yes" has to lead somewhere: "it becomes
 * crucial that the system somehow guides them towards setting up an actual
 * recovery in recovery domain". This page is that somewhere, and it is why
 * `recovery-not-set-up` can now be a real closure blocker.
 */
@Component({
  selector: 'app-recoveries',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    NxButtonModule, NxIconModule, NxMessageModule, NxTableModule, NxContextMenuModule,
    PageHeaderComponent, EmptyStateComponent, StatusChipComponent, AppDatePipe,
  ],
  templateUrl: './recoveries.component.html',
  styleUrl: './recoveries.component.scss',
})
export class RecoveriesComponent implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly svc         = inject(MockRecoveryService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly dialogSvc   = inject(NxDialogService);
  private readonly toast       = inject(ToastService);

  readonly rows     = signal<RecoveryCase[]>([]);
  readonly claim    = signal<ClaimOverview | null>(null);
  readonly loading  = signal(true);

  private sections: { id: string; name: string }[] = [];

  claimId = '';

  readonly state = computed<RecoveryPotentialState>(() => {
    const claim = this.claim();
    return claim ? recoveryPotentialState(claim) : 'unanswered';
  });

  readonly isClosedClaim = computed(() => this.claim()?.status === 'Closed');

  /** The guidance line. Only the two unsettled states earn a banner. */
  readonly guidance = computed<RecoveryGuidance | null>(() => {
    const state = this.state();
    if (state !== 'unanswered' && state !== 'yes-pending') return null;
    return {
      context: state === 'unanswered' ? 'warning' : 'info',
      message: RECOVERY_STATE_MESSAGE[state],
      showOverviewLink: state === 'unanswered',
    };
  });

  readonly currency  = computed(() => this.claim()?.financialSummary.currency ?? 'EUR');
  readonly openCount = computed(() => this.rows().filter(isRecoveryOpen).length);
  readonly expectedTotal = computed(() =>
    this.rows().filter(isRecoveryOpen).reduce((sum, c) => sum + c.estimatedAmount, 0));
  readonly recoveredTotal = computed(() =>
    this.rows().reduce((sum, c) => sum + c.recoveredAmount, 0));

  async ngOnInit(): Promise<void> {
    this.claimId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    // Overview first: MockRecoveryService.syncClaimFlags writes through
    // patchOverview, which no-ops on a claim that has no overview record yet.
    const claim = await firstValueFrom(this.overviewSvc.getOverview(this.claimId));
    const cases = await firstValueFrom(this.svc.search({ claimId: this.claimId }));
    const secs  = await firstValueFrom(this.sectionSvc.getByClaimId(this.claimId));
    this.sections = secs.map(s => ({ id: s.id, name: s.name }));
    this.rows.set(cases);
    // Re-derive rather than trust the seeded flags — the two are hand-authored
    // in claim-overview.json and would drift the moment either file is edited.
    this.claim.set({ ...claim, ...this.svc.syncClaimFlags(this.claimId) });
    this.loading.set(false);
  }

  chipStatus(s: RecoveryCaseStatus): string { return STATUS_CHIP_MAP[s]; }

  isOpen(c: RecoveryCase): boolean { return isRecoveryOpen(c); }

  async create(): Promise<void> {
    const ref = this.dialogSvc.open(CreateRecoveryModalComponent, {
      data: {
        claimId:   this.claimId,
        currency:  this.currency(),
        sections:  this.sections,
        recoveryPotential: this.claim()?.recoveryPotential ?? null,
      } satisfies CreateRecoveryModalData,
      width: '620px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as CreateRecoveryModalResult | undefined;
    if (!result) return;

    const owner = this.claim()?.assignedHandler ?? 'Unassigned';
    const fresh = this.svc.create(this.claimId, this.currency(), owner, result.input);
    this.rows.update(list => [fresh, ...list]);
    this.refreshFlags();
    this.toast.success(
      `Recovery case ${fresh.id} created`,
      'Claim closure no longer waits on a recovery case being set up.',
    );
  }

  async resolve(row: RecoveryCase): Promise<void> {
    const ref = this.dialogSvc.open(ResolveRecoveryModalComponent, {
      data: { recovery: row } satisfies ResolveRecoveryModalData,
      width: '560px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as ResolveRecoveryModalResult | undefined;
    if (!result) return;

    const updated = this.svc.resolve(row.id, result.resolution);
    if (!updated) return;
    this.rows.update(list => list.map(c => (c.id === updated.id ? updated : c)));
    this.refreshFlags();
    this.toast.success(
      `${updated.id} marked as ${updated.status}`,
      this.openCount() === 0
        ? 'No recovery case is holding this claim open any more.'
        : `${this.openCount()} recovery case(s) still open.`,
    );
  }

  /** Push the derived claim-level flags back into the local view model. */
  private refreshFlags(): void {
    const claim = this.claim();
    if (!claim) return;
    this.claim.set({ ...claim, ...this.svc.syncClaimFlags(this.claimId) });
  }
}
