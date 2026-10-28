import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormRecord, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, map, startWith, tap } from 'rxjs';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxRadioToggleModule } from '@allianz/ng-aquila/radio-toggle';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockFinancialOverviewService } from '../../../core/mock/services/mock-financial-overview.service';
import { MockLimitsDeductiblesService } from '../../../core/mock/services/mock-limits-deductibles.service';
import { MockPayeeService } from '../../../core/mock/services/mock-payee.service';
import { MockPaymentEditService } from '../../../core/mock/services/mock-payment-edit.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { FinancialPayment, FinancialReserve } from '../../../core/models/financial-overview.model';
import { preChecksBlockSubmit } from '../../../core/models/financial-precheck.model';
import { PAYMENT_METHODS, Payee } from '../../../core/models/payee.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { FinancialWarningsComponent } from '../../../shared/components/financial-warnings/financial-warnings.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { AmountSectionComponent } from './amount-section/amount-section.component';
import { MethodSectionComponent } from './method-section/method-section.component';
import { PayeeSectionComponent } from './payee-section/payee-section.component';
import { buildChecks, findPayee, missingFields } from './make-payment-checks';
import { createPaymentForm, defaultValues } from './make-payment-form';
import { SubmitMode, confirmData, paymentRecord } from './make-payment-submit';
import {
  applicableDeductibles,
  filledLines,
  fixedDeductibleTotal,
  outstanding,
  payableRows,
  prefillAmounts,
  sectionsPaid,
  totalOf
} from './make-payment-lines';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

// Make Payment: a full page on /claims/:id/financial/new-payment. The link's
// query values (?section=&type=&payee=&amount=&currency=&premiumMode=&confirm=1
// &edit=<paymentId>) pre-fill it, and a new query on the same page refills it.
// Three accordions, the shared warning list on top.
@Component({
  selector: 'app-make-payment-page',
  standalone: true,
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    NxAccordionModule,
    NxButtonModule,
    NxCheckboxModule,
    NxMessageModule,
    NxRadioToggleModule,
    PageHeaderComponent,
    FinancialWarningsComponent,
    PayeeSectionComponent,
    MethodSectionComponent,
    AmountSectionComponent
  ],
  templateUrl: './make-payment-page.component.html',
  styleUrl: './make-payment-page.component.scss'
})
export class MakePaymentPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly financeSvc = inject(MockFinancialOverviewService);
  private readonly limitsSvc = inject(MockLimitsDeductiblesService);
  private readonly stateSvc = inject(MockStateService);
  private readonly editSvc = inject(MockPaymentEditService);
  private readonly payeeSvc = inject(MockPayeeService);
  private readonly sectionSvc = inject(MockSectionService);

  readonly claimId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly currencies = CURRENCIES;
  readonly payees = this.payeeSvc.getPayeesSync(this.claimId);

  readonly form = createPaymentForm();
  // One amount per reserve line, created on demand and kept across currency changes.
  readonly linesForm = new FormRecord<FormControl<number | null>>({});
  readonly limitReason = new FormControl<string | null>('');
  readonly underwriterChecked = new FormControl(false, { nonNullable: true });
  // BMPCC-21754 is undecided, so the prototype lets the team flip between both.
  readonly premiumMode = new FormControl<'block' | 'warn'>('block', { nonNullable: true });
  readonly submitted = signal(false);
  readonly editing = signal<FinancialPayment | null>(null);
  readonly payeeOpen = signal(false);
  readonly methodOpen = signal(false);
  readonly amountOpen = signal(true);

  private readonly confirmRequested = signal(false);
  private readonly values = toSignal(this.form.valueChanges.pipe(startWith(null), map(() => this.form.getRawValue())), {
    initialValue: this.form.getRawValue()
  });
  readonly amounts = toSignal(this.linesForm.valueChanges.pipe(startWith(null), map(() => this.linesForm.getRawValue())), {
    initialValue: {} as Record<string, number | null>
  });
  private readonly payeeWatch = toSignal(
    this.form.controls.payeeId.valueChanges.pipe(tap(id => this.defaultBank(id))),
    { initialValue: null }
  );

  private readonly finance = toSignal(this.financeSvc.getByClaimId(this.claimId));
  private readonly limits = toSignal(this.limitsSvc.getByClaimId(this.claimId));
  private readonly loadedOverview = toSignal(this.overviewSvc.getOverview(this.claimId));
  // Live: "Retry setting up this claim" flips the claim's state while this page is open.
  readonly overview = computed(() => this.stateSvc.state().overviews[this.claimId] ?? this.loadedOverview());
  readonly fo = computed(() => this.stateSvc.state().financialOverviews[this.claimId] ?? this.finance());

  readonly selectedPayee = computed<Payee | null>(() => this.payees.find(p => p.payeeId === this.values().payeeId) ?? null);
  readonly method = computed(() => PAYMENT_METHODS.find(m => m.value === this.values().method) ?? null);
  readonly rows = computed(() => payableRows(this.fo(), this.values().currency));
  readonly lines = computed(() => filledLines(this.rows(), this.amounts()));
  readonly total = computed(() => totalOf(this.lines()));
  readonly paidSections = computed(() => sectionsPaid(this.rows(), this.lines()));
  readonly deductibles = computed(() =>
    applicableDeductibles(this.limits()?.deductibles ?? [], this.paidSections(), this.values().currency)
  );
  readonly deductibleTotal = computed(() => fixedDeductibleTotal(this.deductibles()));
  readonly remaining = (r: FinancialReserve): number => outstanding(r) - Number(this.amounts()[r.reserveId] ?? 0);
  readonly controlFor = (id: string): FormControl<number | null> => {
    let c = this.linesForm.controls[id];
    if (!c) {
      c = new FormControl<number | null>(null);
      this.linesForm.addControl(id, c, { emitEvent: false });
    }
    return c;
  };

  readonly checks = computed(() =>
    buildChecks({
      fo: this.fo(),
      overview: this.overview(),
      limits: this.limits()?.limits ?? [],
      currency: this.values().currency,
      premiumMode: this.premiumModeValue(),
      payee: this.selectedPayee(),
      method: this.method(),
      bankAccountId: this.values().bankAccountId,
      rows: this.rows(),
      lines: this.lines(),
      total: this.total(),
      sectionCount: this.paidSections().length
    })
  );
  private readonly premiumModeValue = toSignal(this.premiumMode.valueChanges.pipe(startWith(this.premiumMode.value)), {
    initialValue: 'block' as const
  });

  readonly blocked = computed(() => preChecksBlockSubmit(this.checks()) || this.checks().some(c => c.holdsSubmit));
  readonly needsLimitReason = computed(() => this.checks().some(c => c.needsReason && !c.afterOutsideBlock));
  // Warning-only unpaid premium (BMPCC-21754 variant): paying out needs a tick.
  readonly needsUnderwriterTick = computed(() => this.checks().some(c => c.id === 'premium-outstanding' && c.level === 'warn'));
  private readonly underwriterTicked = toSignal(this.underwriterChecked.valueChanges, { initialValue: false });
  readonly cannotSubmit = computed(() => this.blocked() || (this.needsUnderwriterTick() && !this.underwriterTicked()));

  readonly missing = computed(() =>
    missingFields(this.values(), this.method(), this.lines().length, !!this.editing() && !this.selectedPayee())
  );

  // Filled from the link or button that opened the page, and again whenever the query changes.
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly prefill = effect(() => {
    const q = this.query();
    untracked(() => this.applyQuery(q));
  });

  private readonly autoConfirm = effect(() => {
    if (!this.confirmRequested() || !this.fo() || !this.overview()) return;
    this.confirmRequested.set(false);
    // Outside the effect, so the submit does not become something the effect watches.
    setTimeout(() => void this.onSubmit('submit'));
  });

  /** Pays into the first account that works, so a fresh payee never starts on a dead one. */
  private defaultBank(payeeId: string | null): void {
    const p = this.payees.find(x => x.payeeId === payeeId);
    const ok = p?.bankAccounts.find(a => a.operational) ?? p?.bankAccounts[0];
    this.form.controls.bankAccountId.setValue(ok?.accountId ?? null, { emitEvent: false });
    if (p?.email) this.form.controls.emailAddress.setValue(p.email, { emitEvent: false });
    this.form.controls.letterAddress.setValue(p?.address ?? '', { emitEvent: false });
    this.form.updateValueAndValidity();
  }

  private applyQuery(q: ParamMap): void {
    const edit = q.get('edit') ? this.editSvc.find(this.claimId, q.get('edit')!) : undefined;
    const editing = edit?.status === 'Requires amendment' ? edit : null;
    this.editing.set(editing);
    const payee = findPayee(this.payees, editing?.payee ?? q.get('payee'));
    const currency = editing?.currency ?? q.get('currency') ?? 'EUR';
    this.form.reset(defaultValues(payee, currency));
    this.defaultBank(payee?.payeeId ?? null);
    this.premiumMode.setValue(q.get('premiumMode') === 'warn' ? 'warn' : 'block');
    this.limitReason.reset('');
    this.underwriterChecked.reset(false);
    this.submitted.set(false);
    this.payeeOpen.set(false);
    this.methodOpen.set(false);
    this.amountOpen.set(true);
    this.confirmRequested.set(q.get('confirm') === '1');
    this.prefillLines(q, editing, currency);
  }

  private prefillLines(q: ParamMap, editing: FinancialPayment | null, currency: string): void {
    for (const c of Object.values(this.linesForm.controls)) c.setValue(null, { emitEvent: false });
    const fo = this.stateSvc.state().financialOverviews[this.claimId];
    const id = q.get('section');
    const sectionName =
      fo?.sections.find(s => s.sectionId === id)?.sectionName ??
      this.sectionSvc.getByClaimIdSync(this.claimId).find(s => s.id === id)?.name;
    const amounts = prefillAmounts(payableRows(fo, currency), editing, {
      sectionName,
      type: q.get('type'),
      amount: q.get('amount') ? Number(q.get('amount')) : null
    });
    for (const [reserveId, amount] of Object.entries(amounts)) this.controlFor(reserveId).setValue(amount, { emitEvent: false });
    this.linesForm.updateValueAndValidity();
  }

  async onSubmit(mode: SubmitMode): Promise<void> {
    this.submitted.set(true);
    const miss = this.missing();
    if (miss.length) {
      this.payeeOpen.set(miss.some(m => ['payeeId', 'beneficiaryName', 'emailAddress', 'letterAddress'].includes(m)));
      this.methodOpen.set(miss.some(m => ['method', 'bankAccountId', 'paymentDate'].includes(m)));
      if (miss.includes('lines')) this.amountOpen.set(true);
      return;
    }
    if (mode === 'submit' && this.cannotSubmit()) return;
    if (mode === 'submit' && this.needsLimitReason() && !this.limitReason.value?.trim()) return;
    const v = this.form.getRawValue();
    const edit = this.editing();
    const payee = this.selectedPayee() ?? { payeeId: '', name: edit!.payee };
    const where = this.paidSections().map(r => r.sectionCode ?? r.section).join(' and ') || 'claim level';
    const summary = `${this.total().toLocaleString('en-GB')} ${v.currency} to ${payee.name} (${this.lines().length} reserve line${this.lines().length === 1 ? '' : 's'}, ${where})`;
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: confirmData(mode, edit?.paymentId ?? null, summary),
      width: '480px',
      maxWidth: '92vw'
    });
    if (!(await firstValueFrom(ref.afterClosed()))) return;
    const sectionType = this.rows().find(r => r.reserveId === this.lines()[0].reserveId)?.reserveType ?? 'Indemnity';
    if (edit) {
      const ok = this.editSvc.resubmit(this.claimId, edit.paymentId, {
        payee: payee.name,
        sectionType,
        amount: this.total(),
        currency: v.currency
      });
      if (ok) this.toast.success('Sent back to your approver', "We'll let you know if it can't be booked.");
      else this.toast.info("This payment can't be changed any more", 'The approver has already dealt with it.');
      this.goToPayments(edit.paymentId);
      return;
    }
    const only = this.paidSections().length === 1 ? this.paidSections()[0].sectionId : undefined;
    const created = await firstValueFrom(
      this.financeSvc.addPayment(
        this.claimId,
        paymentRecord(v, payee, this.lines(), this.total(), sectionType),
        only,
        mode === 'draft' ? 'Draft' : 'Pending'
      )
    );
    if (mode === 'draft') this.toast.success('Saved as a draft', 'It is not sent to your approver yet.');
    else this.toast.success('Sent for approval', "We'll let you know if it can't be booked.");
    this.goToPayments(created.paymentId);
  }

  /** Lands on the Payments list, with the changed payment highlighted. */
  private goToPayments(highlight?: string): void {
    this.router.navigate(['/claims', this.claimId, 'financial'], { queryParams: { view: 'payments', highlight } });
  }

  onCancel(): void {
    this.goToPayments();
  }
}
