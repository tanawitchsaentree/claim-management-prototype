import { Component, computed, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockStateService } from '../../../../../core/mock/state/mock-state.service';
import { MockLargeLossHeadsUpService } from '../../../../../core/mock/services/mock-large-loss-heads-up.service';
import {
  HEADS_UP_REASONS,
  HEADS_UP_THRESHOLD,
  incurredOf
} from '../../../../../core/models/large-loss-heads-up.model';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';
import { AppDatePipe } from '../../../../../shared/pipes/app-date.pipe';
import { ToastService } from '../../../../../shared/components/toast/toast.service';
import {
  CreateHeadsUpDialogComponent,
  CreateHeadsUpDialogData,
  CreateHeadsUpDialogResult
} from '../../../../../shared/components/create-heads-up-dialog/create-heads-up-dialog.component';

// BMPCC-22350: the Heads-Up's home on Claim Overview (DESIGN DECISION HU-1
// Q8). Says whether the claim has one, and is the one way in: create (any
// amount, AC5), continue a draft, or view the submitted one. The threshold
// notice (AC2) sits here too, so a handler arriving from the bell sees why.
// Reads the claim's live state, not the page view model (Claim Overview
// reloads its cards on every state change).
@Component({
  selector: 'app-heads-up-card',
  standalone: true,
  imports: [DecimalPipe, NxButtonModule, NxMessageModule, StatusChipComponent, AppDatePipe],
  templateUrl: './heads-up-card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './heads-up-card.component.scss'
})
export class HeadsUpCardComponent {
  private readonly stateSvc = inject(MockStateService);
  private readonly headsUpSvc = inject(MockLargeLossHeadsUpService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly claimId = input.required<string>();
  readonly threshold = HEADS_UP_THRESHOLD;

  readonly claim = computed(() => this.stateSvc.state().overviews[this.claimId()]);
  readonly headsUp = computed(() => this.claim()?.headsUp);
  readonly incurred = computed(() => incurredOf(this.claim()?.financialSummary));
  readonly currency = computed(() => this.claim()?.financialSummary?.currency ?? 'EUR');
  readonly canCreate = computed(() => !this.headsUp() && this.claim()?.status !== 'Closed');
  readonly reasonText = computed(() => {
    const hu = this.headsUp();
    if (!hu) return '';
    const labels = hu.reasons.map(r => HEADS_UP_REASONS.find(x => x.value === r)?.label ?? r);
    if (hu.origin === 'threshold') labels.unshift('Incurred reached 1M');
    return labels.join(', ');
  });

  open(): void {
    this.router.navigate(['/claims', this.claimId(), 'heads-up']);
  }

  async create(): Promise<void> {
    const ref = this.dialogSvc.open<CreateHeadsUpDialogComponent, CreateHeadsUpDialogData, CreateHeadsUpDialogResult>(
      CreateHeadsUpDialogComponent,
      { data: { claimId: this.claimId(), incurred: this.incurred(), currency: this.currency() }, width: '560px' }
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;
    this.headsUpSvc.create(this.claimId(), result.reasons, result.note);
    this.toast.success('Draft Heads-Up created', 'Check what was filled in from the claim, then add your assessment.');
    this.open();
  }
}
