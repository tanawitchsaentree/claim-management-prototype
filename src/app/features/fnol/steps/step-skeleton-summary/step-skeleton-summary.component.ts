import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolStateService } from '../../services/fnol-state.service';
import { SkeletonReason } from '../../models/fnol-form.model';
import { MockSkeletonClaimService } from '../../../../core/mock/services/mock-skeleton-claim.service';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LocationItem, LookupOption } from '../../../../core/models';

const REASON_LABELS: Record<SkeletonReason, string> = {
  policy_not_issued:    'Policy not yet issued',
  policy_not_found:     'Policy not found in system',
  multi_policy_pending: 'Multi-policy case (pending investigation)',
  other:                'Other',
};

@Component({
  selector: 'app-step-skeleton-summary',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxSpinnerModule,
  ],
  templateUrl: './step-skeleton-summary.component.html',
  styleUrl: './step-skeleton-summary.component.scss',
})
export class StepSkeletonSummaryComponent implements OnInit {
  private fnolState   = inject(FnolStateService);
  private skeletonSvc = inject(MockSkeletonClaimService);
  private lookupSvc   = inject(MockLookupService);
  private router      = inject(Router);
  private toast       = inject(ToastService);

  readonly saving    = signal(false);
  readonly createdId = signal<string | null>(null);

  private causeOpts: LookupOption[] = [];
  private damageOpts: LookupOption[] = [];

  get draft() { return this.fnolState.skeleton; }

  reasonLabel(key: SkeletonReason | undefined): string {
    return key ? REASON_LABELS[key] : '—';
  }

  ngOnInit(): void {
    if (!this.fnolState.skeleton) {
      this.router.navigate(['/fnol/skeleton-create']);
      return;
    }
    this.lookupSvc.getCauseOfLoss().subscribe(o => this.causeOpts = o);
    this.lookupSvc.getTypeOfDamage().subscribe(o => this.damageOpts = o);
  }

  private lossInfo(): { [k: string]: unknown } {
    return (this.fnolState.fnolForm.get('lossInformation')?.value as Record<string, unknown>) ?? {};
  }

  causeLabels(): string {
    const keys = (this.lossInfo()['causeOfLoss'] as string[]) ?? [];
    return keys.map(k => this.causeOpts.find(o => o.value === k)?.label ?? k).join(', ');
  }

  damageLabels(): string {
    const keys = (this.lossInfo()['typeOfDamage'] as string[]) ?? [];
    return keys.map(k => this.damageOpts.find(o => o.value === k)?.label ?? k).join(', ');
  }

  dateValue(field: string): string {
    const dol = (this.lossInfo()['dateOfLoss'] as Record<string, string | null>) ?? {};
    return dol[field] ?? '';
  }

  lossDescription(): string {
    return (this.lossInfo()['lossDescription'] as string) ?? '';
  }

  locations(): LocationItem[] {
    const v = this.lossInfo()['lossLocation'] as { locations?: LocationItem[] } | null;
    return v?.locations ?? [];
  }

  onBack(): void {
    this.router.navigate(['/fnol/skeleton-create']);
  }

  async onCreate(): Promise<void> {
    const draft = this.fnolState.skeleton;
    if (!draft || this.saving()) return;
    this.saving.set(true);
    try {
      const skeleton = await firstValueFrom(
        this.skeletonSvc.create({
          clientName:       draft.clientName,
          reason:           draft.reason,
          notes:            draft.notes,
          lossDate:         null,
          createdBy:        'Current User',
          brokerName:       draft.brokerName,
          insuredName:      draft.insuredName,
          internalNotifier: draft.internalNotifier,
        }),
      );
      this.fnolState.setSkeleton(draft, skeleton.claimId);
      this.fnolState.markStepComplete('skeleton-summary');
      this.createdId.set(skeleton.claimId);
      this.toast.success('Skeleton claim created', skeleton.claimId);
    } finally {
      this.saving.set(false);
    }
  }

  onGoToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
