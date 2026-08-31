import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { MockPolicyOverviewService } from '../../../core/mock/services/mock-policy-overview.service';
import { PolicyOverview } from '../../../core/models/policy-overview.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AppDatePipe } from '../../../shared/pipes/app-date.pipe';

@Component({
  selector: 'app-policy-overview',
  standalone: true,
  imports: [
    CommonModule,
    CurrencyPipe,
    DecimalPipe,
    NxAccordionModule,
    NxTableModule,
    NxSpinnerModule,
    NxMessageModule,
    EmptyStateComponent,
    PageHeaderComponent,
    AppDatePipe,
  ],
  templateUrl: './policy-overview.component.html',
  styleUrl: './policy-overview.component.scss',
})
export class PolicyOverviewComponent implements OnInit {
  private readonly route  = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly svc    = inject(MockPolicyOverviewService);

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly policy    = signal<PolicyOverview | null>(null);

  readonly claimId = signal('');

  // Coinsurance shares must total 100% — a policy whose participants don't add
  // up is a data problem the handler needs to see, not something to silently
  // render. Real production has no equivalent check; this is why we surface it.
  readonly coinsuranceTotal = computed(() =>
    this.policy()?.coinsurance.reduce((sum, p) => sum + p.sharePercent, 0) ?? 0,
  );

  readonly coinsuranceMismatch = computed(() => {
    const list = this.policy()?.coinsurance ?? [];
    return list.length > 0 && this.coinsuranceTotal() !== 100;
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')
      ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
    this.claimId.set(id);
    this.loading.set(true);
    this.loadError.set(false);
    try {
      this.policy.set(await firstValueFrom(this.svc.getByClaimId(id)));
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  openClaim(claimId: string): void {
    this.router.navigate(['/claims', claimId, 'overview']);
  }
}
