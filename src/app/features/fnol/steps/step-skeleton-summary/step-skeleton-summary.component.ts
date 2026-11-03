import { Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { SkeletonReason } from '../../models/fnol-form.model';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { MockLossInformationService } from '../../../../core/mock/services/mock-loss-information.service';
import { LossInformationFormValue } from '../../../../core/models/loss-information.model';
import { MockSectionService } from '../../../../core/mock/services/mock-section.service';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LocationItem, LookupOption } from '../../../../core/models';
import { Party, PARTY_ROLE_LABELS } from '../../../../core/models/party.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { SKELETON_CLAIM_PARAM, SkeletonJourneyService } from '../../services/skeleton-journey.service';

const REASON_LABELS: Record<SkeletonReason, string> = {
  policy_not_issued: 'Policy not yet issued',
  policy_not_found: 'Policy not found in system',
  multi_policy_pending: 'Multi-policy case (pending investigation)',
  other: 'Other'
};

@Component({
  selector: 'app-step-skeleton-summary',
  standalone: true,
  imports: [
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxSpinnerModule,
    EmptyStateComponent,
    WizardFooterComponent
  ],
  templateUrl: './step-skeleton-summary.component.html',
  styleUrl: './step-skeleton-summary.component.scss'
})
export class StepSkeletonSummaryComponent implements OnInit {
  private fnolState = inject(FnolStateService);
  private partiesSvc = inject(MockPartiesService);
  private lookupSvc = inject(MockLookupService);
  private sectionSvc = inject(MockSectionService);
  private lossInfoSvc = inject(MockLossInformationService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private journey = inject(SkeletonJourneyService);

  readonly saving = signal(false);
  readonly createdId = signal<string | null>(null);
  // Restored before the parties list is read, so a reload shows the saved parties.
  private readonly restored = this.journey.restore(
    this.route.snapshot.queryParamMap.get(SKELETON_CLAIM_PARAM)
  );
  readonly parties = toSignal(this.partiesSvc.getOrphanParties(), { initialValue: [] as Party[] });

  private readonly causeOptsSignal = toSignal(this.lookupSvc.getCauseOfLoss(), {
    initialValue: [] as LookupOption[]
  });
  private readonly damageOptsSignal = toSignal(this.lookupSvc.getTypeOfDamage(), {
    initialValue: [] as LookupOption[]
  });

  get draft() {
    return this.fnolState.skeleton;
  }

  reasonLabel(key: SkeletonReason | undefined): string {
    return key ? REASON_LABELS[key] : '—';
  }

  ngOnInit(): void {
    if (!this.restored || !this.fnolState.skeletonClaimId) {
      this.router.navigate(['/fnol/skeleton-create']);
      return;
    }
  }

  rolesDisplay(party: Party): string {
    return party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');
  }

  private lossInfo(): Record<string, unknown> {
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
    this.journey.save('skeleton-parties');
    this.router.navigate(['/fnol/skeleton-parties'], { queryParams: this.journey.queryParams() });
  }

  // Closes the skeleton claim as "cancelled by user" and clears the journey;
  // on failure the handler stays here to retry (BMPCC-18525 AC-3/AC-4).
  async onCancel(): Promise<void> {
    if (this.saving()) return;
    try {
      await this.journey.cancel();
      this.router.navigate(['/dashboard']);
    } catch {
      this.toast.error('Could not cancel the claim', 'Nothing was changed. Please try again.');
    }
  }

  // The claim already exists (created on Loss information's first Next), so
  // this finalises that same claim, never creates a second one (BMPCC-18525).
  async onCreate(): Promise<void> {
    const draft = this.fnolState.skeleton;
    if (!draft || this.saving() || this.createdId()) return;
    this.saving.set(true);
    try {
      const claimId = await this.journey.upsertClaim();
      // What the wizard collected stays with the claim: the loss information
      // (dates, location, cause, description) and the parties from step 2.
      const li = this.lossInfo();
      await firstValueFrom(this.lossInfoSvc.save(li as unknown as LossInformationFormValue, claimId));
      this.partiesSvc.addPartiesToClaim(claimId, this.parties());
      // The section the cause of loss implies shouldn't wait for a policy. Its
      // entity is the property/asset affected (the loss location), never the
      // claimant's own name; the client is only the fallback.
      const causes = (li['causeOfLoss'] as string[]) ?? [];
      if (causes.length && this.sectionSvc.getByClaimIdSync(claimId).length === 0) {
        const entityName = this.locations()[0]?.displayName || draft.clientName;
        await firstValueFrom(this.sectionSvc.createSectionFromCauseOfLoss(claimId, causes, entityName));
      }
      this.createdId.set(claimId);
      this.toast.success('Skeleton claim created', claimId);
      // Journey done: clear its saved state and URL param so the next one starts clean (AC-7).
      this.journey.clear();
      void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    } catch {
      this.toast.error('Could not create the claim', 'Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  onGoToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
