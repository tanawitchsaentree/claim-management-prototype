import { Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { SkeletonReason } from '../../models/fnol-form.model';
import { MockClaimService } from '../../../../core/mock/services/mock-claim.service';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LocationItem, LookupOption } from '../../../../core/models';
import { Party, PARTY_ROLE_LABELS } from '../../../../core/models/party.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

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
    EmptyStateComponent,
  ],
  templateUrl: './step-skeleton-summary.component.html',
  styleUrl: './step-skeleton-summary.component.scss',
})
export class StepSkeletonSummaryComponent implements OnInit {
  private fnolState   = inject(FnolStateService);
  private claimSvc    = inject(MockClaimService);
  private partiesSvc  = inject(MockPartiesService);
  private lookupSvc   = inject(MockLookupService);
  private router      = inject(Router);
  private toast       = inject(ToastService);

  readonly saving    = signal(false);
  readonly createdId = signal<string | null>(null);
  readonly parties   = toSignal(this.partiesSvc.getOrphanParties(), { initialValue: [] as Party[] });

  private readonly causeOptsSignal  = toSignal(this.lookupSvc.getCauseOfLoss(),  { initialValue: [] as LookupOption[] });
  private readonly damageOptsSignal = toSignal(this.lookupSvc.getTypeOfDamage(), { initialValue: [] as LookupOption[] });

  get draft() { return this.fnolState.skeleton; }

  reasonLabel(key: SkeletonReason | undefined): string {
    return key ? REASON_LABELS[key] : '—';
  }

  ngOnInit(): void {
    if (!this.fnolState.skeleton) {
      this.router.navigate(['/fnol/skeleton-create']);
      return;
    }
  }

  rolesDisplay(party: Party): string {
    return party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');
  }

  private lossInfo(): { [k: string]: unknown } {
    return (this.fnolState.fnolForm.get('lossInformation')?.value as Record<string, unknown>) ?? {};
  }

  causeLabels(): string {
    const keys = (this.lossInfo()['causeOfLoss'] as string[]) ?? [];
    return keys.map(k => this.causeOptsSignal().find(o => o.value === k)?.label ?? k).join(', ');
  }

  damageLabels(): string {
    const keys = (this.lossInfo()['typeOfDamage'] as string[]) ?? [];
    return keys.map(k => this.damageOptsSignal().find(o => o.value === k)?.label ?? k).join(', ');
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
    this.router.navigate(['/fnol/skeleton-parties']);
  }

  async onCreate(): Promise<void> {
    const draft = this.fnolState.skeleton;
    if (!draft || this.saving()) return;
    this.saving.set(true);
    try {
      const now = new Date().toISOString().split('T')[0];
      const skeleton = await firstValueFrom(
        this.claimSvc.create({
          policyNumber: '',
          clientName:   draft.clientName,
          broker:       draft.brokerName ?? null,
          assignee:     null,
          createdBy:    'Current User',
          dateUpdated:  now,
          lossDate:     '',
          lossAmount:   0,
          currency:     'EUR',
          description:  draft.notes ?? '',
          status:       'Awaiting policy',
          priority:     'medium',
          lineOfBusiness: 'Property',
          location:     null,
          lossEventId:  null,
          claimType:    'skeleton',
          skeletonReason: draft.reason,
          slaDeadlineDays: 3,
        }, 'SK'),
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
