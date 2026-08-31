import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { MockRiskService } from '../../../../../core/mock/services/mock-risk.service';
import { ToastService } from '../../../../../shared/components/toast/toast.service';

// Extracted out of claim-overview.component.* rather than added to it: that
// file is already 435 lines (limit is 300), and this field owns real state
// (in-flight refresh) plus two grid cells, so it earns its own component.
// Same `display: contents` host trick as mass-event-card — see its SCSS.
@Component({
  selector: 'app-risk-score-field',
  standalone: true,
  imports: [NxIconModule, NxSpinnerModule],
  templateUrl: './risk-score-field.component.html',
  styleUrl: './risk-score-field.component.scss',
})
export class RiskScoreFieldComponent implements OnInit {
  @Input({ required: true }) claimId!: string;
  @Input({ required: true }) riskScore!: number;
  @Input({ required: true }) riskScoreMax!: number;
  @Input({ required: true }) riskStatus!: string;

  private readonly riskSvc = inject(MockRiskService);
  private readonly router  = inject(Router);
  private readonly toast   = inject(ToastService);
  private readonly live    = inject(LiveAnnouncer);

  // Seeded from the inputs, then owned locally so a refresh can show the new
  // score without the parent re-fetching the whole overview. MockRiskService
  // keeps its own cache, so the drifted score survives navigation within the
  // session but not a full reload — same in-memory limit as every other mock.
  readonly score      = signal(0);
  readonly scoreMax   = signal(5);
  readonly status     = signal('');
  readonly refreshing = signal(false);

  readonly severity = computed<'high' | 'medium' | 'low'>(() => {
    const s = this.score();
    if (s >= 4) return 'high';
    if (s >= 3) return 'medium';
    return 'low';
  });

  ngOnInit(): void {
    this.score.set(this.riskScore);
    this.scoreMax.set(this.riskScoreMax);
    this.status.set(this.riskStatus);
  }

  async onRefresh(): Promise<void> {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const updated = await firstValueFrom(this.riskSvc.refresh(this.claimId));
      if (!updated) {
        this.toast.error('Risk score not available', 'No risk analysis exists for this claim yet.');
        return;
      }
      this.score.set(updated.riskScore);
      this.status.set(updated.riskStatus);
      this.live.announce(`Risk score refreshed: ${updated.riskScore} of ${this.scoreMax()}, ${updated.riskStatus}`, 'polite');
    } catch {
      this.toast.error('Could not refresh risk score', 'Try again in a moment.');
    } finally {
      this.refreshing.set(false);
    }
  }

  openInvestigation(): void {
    this.router.navigate(['/claims', this.claimId, 'risk']);
  }
}
