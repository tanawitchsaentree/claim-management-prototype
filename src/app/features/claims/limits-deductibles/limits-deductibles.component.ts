import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxRadioToggleModule } from '@allianz/ng-aquila/radio-toggle';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockLimitsDeductiblesService } from '../../../core/mock/services/mock-limits-deductibles.service';
import { ClaimLimitsDeductibles, FinancialLevel } from '../../../core/models/deductible.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-limits-deductibles',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    NxTableModule,
    NxAccordionModule,
    ReactiveFormsModule,
    NxRadioToggleModule,
    NxSpinnerModule,
    EmptyStateComponent,
    PageHeaderComponent
  ],
  templateUrl: './limits-deductibles.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './limits-deductibles.component.scss'
})
export class LimitsDeductiblesComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(MockLimitsDeductiblesService);

  readonly loading = signal(true);
  readonly data = signal<ClaimLimitsDeductibles | null>(null);
  readonly levelControl = new FormControl<FinancialLevel>('claim', { nonNullable: true });
  readonly level = toSignal(this.levelControl.valueChanges, { initialValue: this.levelControl.value });
  readonly currency = signal('EUR');

  async ngOnInit(): Promise<void> {
    const claimId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.parent?.snapshot.paramMap.get('id') ??
      '';
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.getByClaimId(claimId));
    this.data.set(data);
    this.loading.set(false);
  }
}
