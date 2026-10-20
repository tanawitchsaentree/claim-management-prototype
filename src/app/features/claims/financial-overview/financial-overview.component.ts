import { Component, inject, signal, computed, effect, untracked, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxRadioToggleModule } from '@allianz/ng-aquila/radio-toggle';
import { FinancialReserve } from '../../../core/models/financial-overview.model';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockFinancialOverviewService } from '../../../core/mock/services/mock-financial-overview.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockReservesService } from '../../../core/mock/services/mock-reserves.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { FinancialOverview, FinancialSection } from '../../../core/models/financial-overview.model';
import { ClaimSection } from '../../../core/models/section.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { BlockerReturnBannerComponent } from '../../../shared/components/blocker-return-banner/blocker-return-banner.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { GgRegistrationBannerComponent } from '../../../shared/components/gg-registration-banner/gg-registration-banner.component';
import { RecoveryBookingsTableComponent } from '../../../shared/components/recovery-bookings-table/recovery-bookings-table.component';
import { ListToolbarComponent } from './components/list-toolbar/list-toolbar.component';
import { needsYouCount, notBookedSummary } from './booking-summary';
import { scrollToRow } from '../../../shared/utils/scroll-to-row';
import { GgClaimRegistration } from '../../../core/models/gg-booking.model';
import { ClaimSummaryComponent } from './components/claim-summary/claim-summary.component';
import { PaymentsTableComponent } from './components/payments-table/payments-table.component';
import { ReservesTableComponent } from './components/reserves-table/reserves-table.component';
import { TransactionsTableComponent } from './components/transactions-table/transactions-table.component';
import { SectionSummaryTableComponent } from './components/section-summary-table/section-summary-table.component';
import {
  AddReserveModalComponent,
  AddReserveModalData,
  AddReserveModalResult
} from './components/add-reserve-modal/add-reserve-modal.component';

export type FinancialView = 'overview' | 'payments' | 'reserves' | 'recovery';
type LevelToggle = 'claim' | 'section';
const VIEW_TITLES: Record<FinancialView, string> = {
  overview: 'Financial Overview',
  payments: 'Payments',
  reserves: 'Reserves',
  recovery: 'Recovery bookings'
};
const VALID_VIEWS: FinancialView[] = ['overview', 'payments', 'reserves', 'recovery'];

@Component({
  selector: 'app-financial-overview',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    ReactiveFormsModule,
    NxTableModule,
    NxButtonModule,
    NxSpinnerModule,
    NxDropdownModule,
    NxTooltipModule,
    NxMessageModule,
    NxRadioToggleModule,
    EmptyStateComponent,
    PageHeaderComponent,
    BlockerReturnBannerComponent,
    ClaimSummaryComponent,
    PaymentsTableComponent,
    ReservesTableComponent,
    RecoveryBookingsTableComponent,
    ListToolbarComponent,
    GgRegistrationBannerComponent,
    TransactionsTableComponent,
    SectionSummaryTableComponent
  ],
  templateUrl: './financial-overview.component.html',
  styleUrl: './financial-overview.component.scss'
})
export class FinancialOverviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc = inject(MockFinancialOverviewService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly reservesSvc = inject(MockReservesService);
  private readonly stateSvc = inject(MockStateService);
  private readonly loaded = signal(false);
  constructor() {
    // Query changes (DEV banner, bell, task links): re-apply expand / addReserve each time.
    effect(() => {
      const p = this.params();
      if (this.loaded()) untracked(() => this.landOn(p));
    });
    // State changes (Send again answers later): keep lists and claim banner current.
    effect(() => {
      const st = this.stateSvc.state();
      if (!this.loaded()) return;
      this.ggRegistration.set(st.overviews[this.claimId]?.ggRegistration);
      void firstValueFrom(this.svc.getByClaimId(this.claimId)).then(d => this.fo.set(d));
    });
  }

  claimId = '';

  readonly loading = signal(true);
  readonly fo = signal<FinancialOverview | null>(null);
  readonly levelControl = new FormControl<LevelToggle>('claim', { nonNullable: true });
  readonly level = toSignal(this.levelControl.valueChanges, { initialValue: 'claim' as LevelToggle });
  readonly currency = signal('EUR');
  readonly sectionId = signal('');

  readonly claimClosed = signal(false);
  readonly sectionStatuses = signal<ClaimSection[]>([]);
  readonly noReserveReason = signal<string | null>(null);

  readonly activeSectionClosed = computed(() => {
    const id = this.sectionId();
    return this.sectionStatuses().find(s => s.id === id)?.status === 'Closed';
  });

  readonly actionsDisabled = computed(
    () => this.claimClosed() || (this.level() === 'section' && this.activeSectionClosed())
  );

  readonly actionsDisabledReason = computed(() => {
    if (this.claimClosed()) return 'Claim is closed';
    if (this.level() === 'section' && this.activeSectionClosed()) return 'Section is closed';
    return '';
  });

  private readonly viewParam = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('view') ?? 'overview')),
    { initialValue: this.route.snapshot.queryParamMap.get('view') ?? 'overview' }
  );

  readonly view = computed<FinancialView>(() => {
    const v = this.viewParam();
    return VALID_VIEWS.includes(v as FinancialView) ? (v as FinancialView) : 'overview';
  });

  readonly viewTitle = computed<string>(() => VIEW_TITLES[this.view()]);

  readonly sections = computed<FinancialSection[]>(() => this.fo()?.sections ?? []);

  readonly activeSection = computed<FinancialSection | null>(() => {
    const sections = this.sections();
    if (!sections.length) return null;
    return sections.find(s => s.sectionId === this.sectionId()) ?? sections[0];
  });

  // Section level filters the one claim-level list.
  readonly reserveRows = computed<FinancialReserve[]>(() => {
    const all = this.fo()?.reserves ?? [];
    const rows = this.level() === 'claim' ? all : all.filter(r => r.sectionId === this.activeSection()?.sectionId);
    return this.needsYouOnly().reserves ? rows.filter(r => needsYouCount([r]) > 0) : rows;
  });

  readonly openPaymentId = toSignal(
    this.route.queryParamMap.pipe(map(p => p.get('open'))),
    { initialValue: this.route.snapshot.queryParamMap.get('open') }
  );

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });
  readonly expandId = computed(() => this.params().get('expand') ?? this.params().get('open'));
  readonly highlightId = computed(() => this.params().get('highlight'));

  readonly ggRegistration = signal<GgClaimRegistration | undefined>(undefined);
  readonly needsYouOnly = signal({ payments: false, reserves: false, recovery: false });

  readonly paymentRows = computed(() => {
    const all = this.level() === 'claim' ? (this.fo()?.payments ?? []) : (this.activeSection()?.payments ?? []);
    return this.needsYouOnly().payments ? all.filter(p => needsYouCount([p]) > 0) : all;
  });
  readonly recoveryRows = computed(() => {
    const all = this.level() === 'claim' ? (this.fo()?.recoveries ?? []) : (this.activeSection()?.recoveries ?? []);
    return this.needsYouOnly().recovery ? all.filter(r => needsYouCount([r]) > 0) : all;
  });
  readonly needsYou = computed(() => {
    const d = this.fo();
    return {
      payments: needsYouCount(d?.payments ?? []),
      reserves: needsYouCount(d?.reserves ?? []),
      recovery: needsYouCount(d?.recoveries ?? [])
    };
  });
  readonly notBooked = computed(() => {
    const d = this.fo();
    return d ? notBookedSummary(d) : null;
  });

  setNeedsYouOnly(view: 'payments' | 'reserves' | 'recovery', on: boolean): void {
    this.needsYouOnly.update(v => ({ ...v, [view]: on }));
  }

  async ngOnInit(): Promise<void> {
    const claimId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      '';
    this.claimId = claimId;
    this.loading.set(true);
    const [data, claim, sections] = await Promise.all([
      firstValueFrom(this.svc.getByClaimId(claimId)),
      firstValueFrom(this.overviewSvc.getOverview(claimId)),
      firstValueFrom(this.sectionSvc.getByClaimId(claimId))
    ]);
    this.fo.set(data);
    this.currency.set(data.details.currency);
    this.claimClosed.set(claim.status === 'Closed');
    this.sectionStatuses.set(sections);
    await this.loadNoReserveReason(claimId);
    if (data?.sections?.length) {
      this.sectionId.set(data.sections[0].sectionId);
    }
    this.ggRegistration.set(claim.ggRegistration);
    this.loaded.set(true);
    this.loading.set(false);
  }

  // &expand / &highlight scroll to the row; &addReserve=1 opens Add reserve
  // (prefill: &amount &currency &section).
  private landOn(p: ParamMap): void {
    const id = p.get('expand') ?? p.get('open') ?? p.get('highlight');
    if (id) scrollToRow(id);
    if (p.get('addReserve') !== '1') return;
    const amount = Number(p.get('amount'));
    const prefill = {
      amount: amount > 0 ? amount : undefined,
      currency: p.get('currency') ?? undefined,
      section: p.get('section') ?? undefined
    };
    void this.onAddReserve(prefill);
  }

  private async loadNoReserveReason(claimId: string): Promise<void> {
    const claim = await firstValueFrom(this.overviewSvc.getOverview(claimId));
    const policy = (claim as { policyNumber?: string }).policyNumber;
    if (!policy) return;
    const data = await firstValueFrom(this.reservesSvc.getReservesForPolicy(policy));
    const n = data.narrative;
    this.noReserveReason.set(n && !n.archivedAt ? (n.notes || n.reasonKey) : null);
  }

  setView(v: FinancialView): void {
    this.router.navigate([], { queryParams: { view: v }, replaceUrl: true });
  }

  async onAddReserve(prefill?: { amount?: number; currency?: string; section?: string }): Promise<void> {
    const current = this.fo();
    if (!current) return;
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      // `prefill` is read by the modal (Builder B); extra field until its type has it.
      data: { sections: current.sections, claimId: this.claimId, prefill } as AddReserveModalData,
      width: '600px',
      maxWidth: '92vw'
    });
    const input = (await firstValueFrom(ref.afterClosed())) as AddReserveModalResult;
    if (!input) return;
    await firstValueFrom(this.svc.addReserve(this.claimId, input));
    this.fo.set(await firstValueFrom(this.svc.getByClaimId(this.claimId)));
    this.toast.success(
      'Reserve added',
      `${input.currency} ${input.reserveValue.toLocaleString()} reserve added.`
    );
  }

  async onUpdateReserve(reserve: FinancialReserve): Promise<void> {
    const current = this.fo();
    if (!current) return;
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { sections: current.sections, reserve } satisfies AddReserveModalData,
      width: '600px',
      maxWidth: '92vw'
    });
    const input = (await firstValueFrom(ref.afterClosed())) as AddReserveModalResult;
    if (!input) return;
    await firstValueFrom(
      this.svc.updateReserveAmount(this.claimId, reserve.reserveId, input.reserveValue, input.reason ?? '')
    );
    this.fo.set(await firstValueFrom(this.svc.getByClaimId(this.claimId)));
    this.toast.success(
      'Reserve updated',
      `${reserve.reserveId} is now ${input.currency} ${input.reserveValue.toLocaleString()} and waits for approval.`
    );
  }

  onMakePayment(): void {
    this.router.navigate(['/claims', this.claimId, 'financial', 'new-payment']);
  }
}
