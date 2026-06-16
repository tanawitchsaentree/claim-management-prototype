import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockFinancialOverviewService } from '../../../core/mock/services/mock-financial-overview.service';
import { FinancialOverview } from '../../../core/models/financial-overview.model';

type LevelToggle = 'claim' | 'section';

@Component({
  selector: 'app-financial-overview',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    NxTabsModule,
    NxTableModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
  ],
  templateUrl: './financial-overview.component.html',
  styleUrl:    './financial-overview.component.scss',
})
export class FinancialOverviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc   = inject(MockFinancialOverviewService);

  readonly loading   = signal(true);
  readonly fo        = signal<FinancialOverview | null>(null);
  readonly level     = signal<LevelToggle>('claim');
  readonly currency  = signal('EUR');
  readonly activeTab = signal(0);

  get currencies(): string[] {
    const payments = this.fo()?.payments.map(p => p.currency) ?? [];
    return [...new Set(['EUR', ...payments])];
  }

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
      ?? this.route.parent?.snapshot.paramMap.get('id')
      ?? '';
    console.log('[FO] claimId=', claimId);
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.getByClaimId(claimId));
    console.log('[FO] data=', data);
    this.fo.set(data);
    this.loading.set(false);
  }
}
