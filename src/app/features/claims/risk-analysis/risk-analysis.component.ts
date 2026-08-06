import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { MockRiskService } from '../../../core/mock/services/mock-risk.service';
import { RiskAnalysis, RiskScore, RiskStatusLabel, InvestigationStatus, InvestigationOutcome } from '../../../core/models';
import {
  StartInvestigationModalComponent,
  StartInvestigationModalData,
  StartInvestigationResult,
} from './start-investigation-modal/start-investigation-modal.component';

const RISK_STATUS_CHIP: Record<RiskStatusLabel, string> = {
  'Low risk':       'closed',
  'Potential risk': 'in-progress',
  'High risk':      'rejected',
};

const INVESTIGATION_CHIP: Record<InvestigationStatus, string> = {
  'Not started': 'open',
  'In progress': 'in-progress',
  'Completed':   'closed',
};

const OUTCOME_CHIP: Record<InvestigationOutcome, string> = {
  'N/A':                'open',
  'Inconclusive':       'in-progress',
  'Fraud confirmed':    'rejected',
  'No fraud detected':  'closed',
};

const SCORE_CHIP: Record<RiskScore, string> = {
  1: 'closed',
  2: 'closed',
  3: 'in-progress',
  4: 'rejected',
  5: 'rejected',
};

@Component({
  selector: 'app-risk-analysis',
  standalone: true,
  imports: [
    CommonModule,
    NxIconModule,
    NxButtonModule,
    NxSpinnerModule,
    NxModalModule,
    StatusChipComponent,
    EmptyStateComponent,
    PageHeaderComponent,
  ],
  templateUrl: './risk-analysis.component.html',
  styleUrl: './risk-analysis.component.scss',
})
export class RiskAnalysisComponent implements OnInit {
  private readonly route     = inject(ActivatedRoute);
  private readonly svc       = inject(MockRiskService);
  private readonly toast     = inject(ToastService);
  private readonly dialogSvc = inject(NxDialogService);

  readonly model      = signal<RiskAnalysis | null>(null);
  readonly loading    = signal(true);
  readonly refreshing = signal(false);
  readonly markingNoRisk = signal(false);

  readonly riskStatusChip    = computed(() => { const m = this.model(); return m ? RISK_STATUS_CHIP[m.riskStatus] : 'open'; });
  readonly investigationChip = computed(() => { const m = this.model(); return m ? INVESTIGATION_CHIP[m.investigationStatus] : 'open'; });
  readonly outcomeChip       = computed(() => { const m = this.model(); return m ? OUTCOME_CHIP[m.investigationOutcome] : 'open'; });
  readonly scoreChip         = computed(() => { const m = this.model(); return m ? SCORE_CHIP[m.riskScore] : 'open'; });
  readonly hasInvestigation  = computed(() => this.model()?.investigationStatus !== 'Not started');
  readonly isNoRisk          = computed(() => this.model()?.riskScore === 1 && this.model()?.riskStatus === 'Low risk');

  private claimId = '';

  ngOnInit(): void {
    this.claimId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    const data = await firstValueFrom(this.svc.getByClaim(this.claimId));
    this.model.set(data);
    this.loading.set(false);
  }

  async refreshScore(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    const updated = await firstValueFrom(this.svc.refresh(this.claimId));
    if (updated) {
      this.model.set(updated);
      this.toast.success(`Risk score refreshed: ${updated.riskScore}/5`);
    }
    this.refreshing.set(false);
  }

  async markNoRisk(): Promise<void> {
    if (this.markingNoRisk()) return;
    this.markingNoRisk.set(true);
    const updated = await firstValueFrom(this.svc.markNoRisk(this.claimId));
    if (updated) {
      this.model.set(updated);
      this.toast.success('Marked as No risk', 'Risk score set to 1/5 — Low risk');
    }
    this.markingNoRisk.set(false);
  }

  startInvestigation(): void {
    const data: StartInvestigationModalData = { claimId: this.claimId };
    const ref = this.dialogSvc.open(StartInvestigationModalComponent, { data, width: '600px', maxWidth: '92vw' });
    ref.afterClosed().subscribe(async (result: StartInvestigationResult | null | undefined) => {
      if (!result) return;
      const updated = await firstValueFrom(this.svc.startInvestigation(this.claimId, result.assignee, result.deadline));
      if (updated) {
        this.model.set(updated);
        this.toast.success(`Investigation assigned to ${result.assignee}`);
      }
    });
  }
}
