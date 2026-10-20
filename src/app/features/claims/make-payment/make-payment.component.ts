import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { combineLatest, firstValueFrom, map, startWith } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxRadioToggleModule } from '@allianz/ng-aquila/radio-toggle';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockFinancialOverviewService } from '../../../core/mock/services/mock-financial-overview.service';
import { MockLimitsDeductiblesService } from '../../../core/mock/services/mock-limits-deductibles.service';
import { financialPreChecks, preChecksBlockSubmit } from '../../../core/models/financial-precheck.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FinancialWarningsComponent } from '../../../shared/components/financial-warnings/financial-warnings.component';
import { claimHeadroom, sameSection } from '../../../shared/components/financial-warnings/limit-headroom';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ClaimNumberPipe } from '../../../shared/pipes/claim-number.pipe';
import { ToastService } from '../../../shared/components/toast/toast.service';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];
const PAYMENT_TYPES = ['Indemnity', 'Expenses'];
const CLAIM_LEVEL = '';

@Component({
  selector: 'app-make-payment',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxButtonModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    NxRadioToggleModule,
    PageHeaderComponent,
    ClaimNumberPipe,
    FinancialWarningsComponent
  ],
  templateUrl: './make-payment.component.html',
  styleUrl: './make-payment.component.scss'
})
export class MakePaymentComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly financeSvc = inject(MockFinancialOverviewService);
  private readonly limitsSvc = inject(MockLimitsDeductiblesService);
  private readonly stateSvc = inject(MockStateService);

  readonly claimId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly currencies = CURRENCIES;
  readonly paymentTypes = PAYMENT_TYPES;
  readonly claimLevel = CLAIM_LEVEL;

  readonly form = new FormGroup({
    section: new FormControl<string>(CLAIM_LEVEL, { nonNullable: true }),
    paymentType: new FormControl<string | null>(null, [Validators.required]),
    payee: new FormControl('', [Validators.required]),
    currency: new FormControl('EUR', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)])
  });
  readonly limitReason = new FormControl<string | null>('', [Validators.required]);
  // BMPCC-21754 is undecided, so the prototype lets the team flip between both.
  readonly premiumMode = new FormControl<'block' | 'warn'>('block', { nonNullable: true });
  readonly submitted = signal(false);

  // The DEV banner (and "Add reserve, then come back") land here with the form
  // already filled in: ?section=&type=&payee=&amount=&currency=&premiumMode=&confirm=1
  private readonly query = this.route.snapshot.queryParamMap;
  private readonly openConfirm = this.query.get('confirm') === '1';

  // Filled in the constructor, before the first render, so nothing changes after the page is checked.
  constructor() {
    const q = this.query;
    const amount = q.get('amount');
    this.form.patchValue({
      section: q.get('section') ?? CLAIM_LEVEL,
      paymentType: q.get('type'),
      payee: q.get('payee') ?? '',
      currency: q.get('currency') ?? 'EUR',
      amount: amount ? Number(amount) : null
    });
    if (q.get('premiumMode') === 'warn') this.premiumMode.setValue('warn');
  }

  private confirmed = false;
  private readonly autoConfirm = effect(() => {
    if (!this.openConfirm || this.confirmed || !this.finance() || !this.overview()) return;
    this.confirmed = true;
    setTimeout(() => void this.onSubmit());
  });

  private readonly finance = toSignal(this.financeSvc.getByClaimId(this.claimId));
  private readonly limits = toSignal(this.limitsSvc.getByClaimId(this.claimId));
  private readonly loadedOverview = toSignal(this.overviewSvc.getOverview(this.claimId));
  // Live: "Send claim again" flips the claim's state while this page is open.
  readonly overview = computed(() => this.stateSvc.state().overviews[this.claimId] ?? this.loadedOverview());
  readonly sections = computed(() => this.finance()?.sections ?? []);

  private readonly inputs = toSignal(
    combineLatest([
      this.form.valueChanges.pipe(startWith(null)),
      this.premiumMode.valueChanges.pipe(startWith('block' as const))
    ]).pipe(map(() => ({ ...this.form.getRawValue(), premiumMode: this.premiumMode.value }))),
    { initialValue: { ...this.form.getRawValue(), premiumMode: 'block' as const } }
  );

  readonly checks = computed(() => {
    const v = this.inputs();
    const fo = this.finance();
    const ov = this.overview();
    const section = this.sections().find(s => s.sectionId === v.section);
    // Reserves a payment can draw on: the chosen section's, or the whole claim's.
    const pool = (fo?.reserves ?? []).filter(
      r => r.status !== 'Rejected' && (!section || sameSection(r.section, section.sectionName))
    );
    const head = claimHeadroom(fo, this.limits()?.limits ?? [], v.currency, section?.sectionName);
    return financialPreChecks({
      journey: 'payment',
      ggRegistration: ov?.ggRegistration,
      premiumOutstanding: ov?.premiumOutstanding,
      premiumMode: v.premiumMode,
      currency: v.currency,
      reserveCurrencies: [...new Set(pool.map(r => r.currency))],
      amount: v.amount ?? undefined,
      limitRemaining: head?.remaining,
      limitName: head?.name
    });
  });

  readonly blocked = computed(() => preChecksBlockSubmit(this.checks()));
  readonly needsLimitReason = computed(() => this.checks().some(c => c.needsReason));

  async onSubmit(): Promise<void> {
    this.submitted.set(true);
    if (this.blocked() || this.form.invalid) return;
    if (this.needsLimitReason() && this.limitReason.invalid) return;
    const v = this.form.getRawValue();
    const where = this.sections().find(s => s.sectionId === v.section)?.sectionName ?? 'claim level';
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Send this payment for approval?',
        message: `${v.amount!.toLocaleString('en-GB')} ${v.currency} to ${v.payee}, ${v.paymentType}, ${where}. It goes to your approver. Once approved, it is booked in Global Genius automatically.`,
        confirmLabel: 'Send for approval',
        cancelLabel: 'Cancel',
        hideIcon: true
      } satisfies ConfirmDialogData,
      width: '480px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    const section = this.sections().find(s => s.sectionId === v.section);
    const created = await firstValueFrom(
      this.financeSvc.addPayment(this.claimId, {
        reinsuranceId: '',
        payee: v.payee!,
        handler: '',
        sectionType: v.paymentType!,
        amount: v.amount!,
        currency: v.currency,
        paymentDate: ''
      }, section?.sectionId)
    );
    this.toast.success(
      'Sent for approval',
      "We'll let you know if it can't be booked."
    );
    this.router.navigate(['/claims', this.claimId, 'financial'], {
      queryParams: { view: 'payments', highlight: created.paymentId }
    });
  }

  onCancel(): void {
    this.router.navigate(['/claims', this.claimId, 'financial'], { queryParams: { view: 'payments' } });
  }
}
