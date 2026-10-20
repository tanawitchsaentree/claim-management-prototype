import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, map, startWith } from 'rxjs';

import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { FinancialWarningsComponent } from '../../../../../shared/components/financial-warnings/financial-warnings.component';
import { limitHeadroom } from '../../../../../shared/components/financial-warnings/limit-headroom';
import { MockClaimOverviewService } from '../../../../../core/mock/services/mock-claim-overview.service';
import { MockLimitsDeductiblesService } from '../../../../../core/mock/services/mock-limits-deductibles.service';
import { financialPreChecks } from '../../../../../core/models/financial-precheck.model';
import {
  FinancialReserve,
  FinancialSection
} from '../../../../../core/models/financial-overview.model';

export interface AddReserveModalData {
  sections: FinancialSection[];
  // Set = update this reserve: only the amount (and a reason) can change.
  reserve?: FinancialReserve;
  // Falls back to the claim in the URL when the caller doesn't pass it.
  claimId?: string;
}

export type AddReserveModalResult =
  | (Omit<FinancialReserve, 'reserveId'> & { reason?: string })
  | null;

const RESERVE_TYPES = ['Indemnity', 'Expenses'];
const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'];

@Component({
  selector: 'app-add-reserve-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    FinancialWarningsComponent
  ],
  templateUrl: './add-reserve-modal.component.html',
  styleUrl: './add-reserve-modal.component.scss'
})
export class AddReserveModalComponent {
  readonly data = inject<AddReserveModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AddReserveModalComponent, AddReserveModalResult>>(NxModalRef);

  readonly reserveTypes = RESERVE_TYPES;
  readonly currencies = CURRENCIES;

  readonly form = new FormGroup({
    reserveType: new FormControl<string | null>(null, [Validators.required]),
    reserveSubType: new FormControl('', [Validators.required]),
    party: new FormControl('', [Validators.required]),
    damagedItem: new FormControl(''),
    section: new FormControl<string | null>(null),
    reserveValue: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    currency: new FormControl<string | null>('EUR', [Validators.required])
  });

  readonly editing = this.data.reserve ?? null;
  readonly reason = new FormControl('', [Validators.required]);

  private readonly claimId =
    this.data.claimId ?? inject(Router).url.match(/\/claims\/([^/?]+)/)?.[1] ?? '';
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly limitsSvc = inject(MockLimitsDeductiblesService);

  readonly checks = toSignal(
    combineLatest([
      this.overviewSvc.getOverview(this.claimId),
      this.limitsSvc.getByClaimId(this.claimId),
      this.form.valueChanges.pipe(startWith(null))
    ]).pipe(
      map(([overview, ld]) => {
        const v = this.form.getRawValue();
        const section = this.data.sections.find(s => s.sectionId === v.section);
        const others = this.data.sections.flatMap(s => s.reserves).filter(r => r.reserveId !== this.editing?.reserveId);
        const head = limitHeadroom(ld.limits, others, v.currency ?? 'EUR', section?.sectionName);
        return financialPreChecks({
          journey: 'reserve',
          ggRegistration: overview.ggRegistration,
          amount: v.reserveValue ?? undefined,
          limitRemaining: head?.remaining,
          limitName: head?.name
        });
      })
    ),
    { initialValue: [] }
  );

  constructor() {
    const r = this.editing;
    if (!r) return;
    this.form.patchValue({
      reserveType: r.reserveType,
      reserveSubType: r.reserveSubType,
      party: r.party,
      damagedItem: r.damagedItem,
      section: r.sectionId ?? null,
      reserveValue: r.reserveValue,
      currency: r.currency
    });
    // A reserve keeps what it is; only how much changes.
    for (const name of ['reserveType', 'reserveSubType', 'party', 'damagedItem', 'section', 'currency'] as const) {
      this.form.get(name)!.disable();
    }
  }

  submitted = false;

  onCancel(): void {
    this.modalRef.close(null);
  }

  onSave(): void {
    this.submitted = true;
    if (this.form.invalid || (this.editing && this.reason.invalid)) return;
    if (this.checks().some(c => c.level === 'block')) return;
    const v = this.form.getRawValue();
    this.modalRef.close({
      reserveType: v.reserveType!,
      reserveSubType: v.reserveSubType!,
      party: v.party!,
      damagedItem: v.damagedItem ?? '',
      section: v.section ?? '',
      reserveValue: v.reserveValue!,
      currency: v.currency!,
      // Whoever sets a reserve can't approve it: it always starts Pending and is
      // approved separately.
      status: 'Pending',
      reason: this.editing ? (this.reason.value ?? '') : undefined
    });
  }
}
