import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockFinancialOverviewService } from '../../../core/mock/services/mock-financial-overview.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { FinancialOverview, FinancialSection } from '../../../core/models/financial-overview.model';
import { ClaimSection } from '../../../core/models/section.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AddReserveModalComponent, AddReserveModalData, AddReserveModalResult } from './components/add-reserve-modal/add-reserve-modal.component';

export type FinancialView = 'overview' | 'payments' | 'reserves' | 'recovery';
type LevelToggle = 'claim' | 'section';
const VALID_VIEWS: FinancialView[] = ['overview', 'payments', 'reserves', 'recovery'];

@Component({
  selector: 'app-financial-overview',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxDropdownModule,
    NxTooltipModule,
    NxMessageModule,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './financial-overview.component.html',
  styleUrl:    './financial-overview.component.scss',
})
export class FinancialOverviewComponent implements OnInit {
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);
  private readonly svc         = inject(MockFinancialOverviewService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc  = inject(MockSectionService);
  private readonly dialogSvc   = inject(NxDialogService);

  private claimId = '';

  readonly loading   = signal(true);
  readonly fo        = signal<FinancialOverview | null>(null);
  readonly level     = signal<LevelToggle>('claim');
  readonly currency  = signal('EUR');
  readonly sectionId = signal('');
  readonly expandedReserveIds = signal<Set<string>>(new Set());

  // BMPCC-14826 — same claimClosed-gating pattern as sections.ts (claim.status
  // fetched via MockClaimOverviewService.getOverview()); sectionStatuses is
  // the real ClaimSection list (financial-overview's own FinancialSection
  // model has no status field) so the active section's closed state can be
  // looked up by sectionId.
  readonly claimClosed     = signal(false);
  readonly sectionStatuses = signal<ClaimSection[]>([]);

  readonly activeSectionClosed = computed(() => {
    const id = this.sectionId();
    return this.sectionStatuses().find(s => s.id === id)?.status === 'Closed';
  });

  readonly actionsDisabled = computed(() =>
    this.claimClosed() || (this.level() === 'section' && this.activeSectionClosed()));

  readonly actionsDisabledReason = computed(() => {
    if (this.claimClosed()) return 'Claim is closed';
    if (this.level() === 'section' && this.activeSectionClosed()) return 'Section is closed';
    return '';
  });

  private readonly viewParam = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('view') ?? 'overview')),
    { initialValue: this.route.snapshot.queryParamMap.get('view') ?? 'overview' },
  );

  readonly view = computed<FinancialView>(() => {
    const v = this.viewParam();
    return VALID_VIEWS.includes(v as FinancialView) ? (v as FinancialView) : 'overview';
  });

  readonly viewTitle = computed<string>(() => {
    switch (this.view()) {
      case 'payments': return 'Payments';
      case 'reserves': return 'Reserves';
      case 'recovery': return 'Recovery bookings';
      default:         return 'Financial Overview';
    }
  });

  readonly sections = computed<FinancialSection[]>(() => this.fo()?.sections ?? []);

  readonly activeSection = computed<FinancialSection | null>(() => {
    const sections = this.sections();
    if (!sections.length) return null;
    return sections.find(s => s.sectionId === this.sectionId()) ?? sections[0];
  });

  get kpis() {
    const s = this.fo()?.summary;
    if (!s) return [];
    return [
      { label: 'Outstanding reserves', value: s.outstandingReserves },
      { label: 'Completed payments',   value: s.completedPayments },
      { label: 'Pending payments',     value: s.pendingPayments },
      { label: 'Recoveries',           value: s.recoveries },
      { label: 'Incurred',             value: s.incurred },
    ];
  }

  async ngOnInit(): Promise<void> {
    const claimId = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.claimId = claimId;
    this.loading.set(true);
    const [data, claim, sections] = await Promise.all([
      firstValueFrom(this.svc.getByClaimId(claimId)),
      firstValueFrom(this.overviewSvc.getOverview(claimId)),
      firstValueFrom(this.sectionSvc.getByClaimId(claimId)),
    ]);
    this.fo.set(data);
    this.claimClosed.set(claim.status === 'Closed');
    this.sectionStatuses.set(sections);
    if (data?.sections?.length) {
      this.sectionId.set(data.sections[0].sectionId);
    }
    this.loading.set(false);
  }

  setView(v: FinancialView): void {
    this.router.navigate([], { queryParams: { view: v }, replaceUrl: true });
  }

  setLevel(l: LevelToggle): void {
    this.level.set(l);
  }

  // The "Update reserves" button had no handler at all before this — there
  // was no way to add a reserve on a claim outside the FNOL wizard.
  async onAddReserve(): Promise<void> {
    const current = this.fo();
    if (!current) return;
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { sections: current.sections } satisfies AddReserveModalData,
      width: '600px',
      maxWidth: '92vw',
    });
    const input = await firstValueFrom(ref.afterClosed()) as AddReserveModalResult;
    if (!input) return;
    await firstValueFrom(this.svc.addReserve(this.claimId, input));
    this.fo.set(await firstValueFrom(this.svc.getByClaimId(this.claimId)));
  }

  toggleReserveHistory(id: string): void {
    const s = new Set(this.expandedReserveIds());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedReserveIds.set(s);
  }

  isReserveExpanded(id: string): boolean {
    return this.expandedReserveIds().has(id);
  }
}
