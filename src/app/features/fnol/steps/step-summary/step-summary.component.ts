import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, combineLatest } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { MockSkeletonClaimService } from '../../../../core/mock/services/mock-skeleton-claim.service';
import { EntitiesDamagesData } from '../../../../core/models';
import { ReserveNarrative, ReservesPolicyData } from '../../../../core/models/reserve.model';
import { LookupOption } from '../../../../core/models/lookup.model';

export interface ClaimGroup {
  policyNumber: string;
  damageTypes: string[];
  sectionCount: number;
  partyCount: number;
  totalReserve: number;
  currency: string;
}

export interface SummaryViewModel {
  causesOfLoss: string[];
  dateOfOccurrence: string;
  timeOfOccurrence: string;
  dateOfNotification: string;
  affectedPolicies: string[];
  damageTypes: string[];
  sectionCount: number;
  nonCoveredCases: string[];
  claimGroups: ClaimGroup[];
  narrative: ReserveNarrative | null;
  narrativeReasonLabel: string;
  isSkeletonPath: boolean;
  skeletonClientName: string;
  skeletonReason: string;
}

@Component({
  selector: 'app-step-summary',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxSwitcherModule,
    DatePipe,
    WizardFooterComponent,
  ],
  templateUrl: './step-summary.component.html',
  styleUrl: './step-summary.component.scss',
})
export class StepSummaryComponent implements OnInit {
  private readonly fnolState    = inject(FnolStateService);
  private readonly entitiesSvc  = inject(MockEntitiesDamagesService);
  private readonly reservesSvc  = inject(MockReservesService);
  private readonly partiesSvc   = inject(MockPartiesService);
  private readonly lookupSvc    = inject(MockLookupService);
  private readonly skeletonSvc  = inject(MockSkeletonClaimService);
  private readonly router       = inject(Router);

  readonly vm$ = new BehaviorSubject<SummaryViewModel | null>(null);
  loadError  = false;
  submitted  = false;
  mockClaimIds = ['CL-2025-001', 'CL-2025-002'];
  accessRestricted = new FormControl(false);

  get policyNumber(): string { return this.fnolState.selectedPolicy?.policyNumber ?? ''; }

  async ngOnInit(): Promise<void> {
    const isOrphan = this.fnolState.path === 'orphan';

    if (isOrphan && this.fnolState.selectedClient) {
      // skeleton path — valid
    } else if (!isOrphan && this.fnolState.selectedPolicy) {
      // standard path — valid
    } else {
      this.router.navigate(['/fnol/search']);
      return;
    }

    try {
      const vm = await this.buildViewModel();
      this.vm$.next(vm);
    } catch (err) {
      console.error('[StepSummary] buildViewModel failed:', err);
      this.loadError = true;
    }
  }

  onCancel(): void { this.router.navigate(['/dashboard']); }
  onBack(): void   { this.router.navigate(['/fnol/reserves']); }

  async onSubmit(): Promise<void> {
    const state = {
      policy:   this.fnolState.selectedPolicy,
      client:   this.fnolState.selectedClient,
      path:     this.fnolState.path,
      lossInfo: this.fnolState.fnolForm.get('lossInformation')?.value,
      summary:  this.vm$.value,
    };
    console.log('[Summary] Submitting claim state:', state);

    // BMPCC-11006: if this submission converts a skeleton, link it to the
    // newly-created regular claim so the skeleton transitions to 'matched'.
    const skeletonId = this.fnolState.skeletonClaimId;
    const policyNumber = this.fnolState.selectedPolicy?.policyNumber;
    if (skeletonId && this.fnolState.path === 'standard' && policyNumber) {
      const newClaimId = this.mockClaimIds[0];
      try {
        await firstValueFrom(
          this.skeletonSvc.matchToPolicy(skeletonId, policyNumber, 'Current User', newClaimId),
        );
      } catch (err) {
        console.error('[Summary] matchToPolicy failed:', err);
      }
    }

    this.fnolState.markStepComplete('summary');
    this.submitted = true;
  }

  onClose(): void { this.router.navigate(['/claims/CL-2025-001/overview']); }

  // ── Private ───────────────────────────────────────────────────────────────────

  private async buildViewModel(): Promise<SummaryViewModel> {
    if (this.fnolState.path === 'orphan') {
      const skeleton = this.fnolState.skeleton;
      return {
        causesOfLoss: [],
        dateOfOccurrence: '—',
        timeOfOccurrence: '—',
        dateOfNotification: '—',
        affectedPolicies: [],
        damageTypes: [],
        sectionCount: 0,
        nonCoveredCases: [],
        claimGroups: [],
        narrative: null,
        narrativeReasonLabel: '',
        isSkeletonPath: true,
        skeletonClientName: skeleton?.clientName ?? '—',
        skeletonReason: skeleton?.reason ?? '—',
      };
    }

    const lossGroup  = this.fnolState.fnolForm.get('lossInformation')!;
    const dateOfLoss = lossGroup.get('dateOfLoss')!;
    const causeKeys  = (lossGroup.get('causeOfLoss')?.value as string[]) ?? [];

    const [causeLookups, damageLookups, narrativeOpts, entitiesData, reservesData, parties] =
      await firstValueFrom(combineLatest([
        this.lookupSvc.getCauseOfLoss(),
        this.lookupSvc.getTypeOfDamage(),
        this.lookupSvc.getNarrativeOptions(),
        this.entitiesSvc.getByPolicyId(this.policyNumber),
        this.reservesSvc.getReservesForPolicy(this.policyNumber),
        this.partiesSvc.getPartiesForPolicy(this.policyNumber),
      ]));

    const causesOfLoss = causeKeys.map(k => this.label(causeLookups, k));

    const allEntities = entitiesData.sections
      .flatMap(s => s.damageGroups)
      .flatMap(g => g.entities);

    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const damageTypes = damageTypeKeys.map(k => this.label(damageLookups, k));
    const sectionCount = allEntities.length;

    const nonCoveredCases = this.buildNonCoveredCases(entitiesData, damageLookups);
    const claimGroups = this.buildClaimGroups(entitiesData, reservesData, parties.length, damageLookups);

    const narrative = reservesData.narrative && !reservesData.narrative.archivedAt
      ? reservesData.narrative : null;
    const narrativeReasonLabel = narrative
      ? (narrativeOpts.find(o => o.value === narrative.reasonKey)?.label ?? narrative.reasonKey)
      : '';

    return {
      causesOfLoss,
      dateOfOccurrence:   this.formatDate(dateOfLoss.get('dateOfOccurrence')?.value),
      timeOfOccurrence:   dateOfLoss.get('timeOfOccurrence')?.value ?? '—',
      dateOfNotification: this.formatDate(dateOfLoss.get('dateOfNotification')?.value),
      affectedPolicies:   [this.policyNumber],
      damageTypes,
      sectionCount,
      nonCoveredCases,
      claimGroups,
      narrative,
      narrativeReasonLabel,
      isSkeletonPath:     false,
      skeletonClientName: '—',
      skeletonReason:     '—',
    };
  }

  private buildClaimGroups(
    data: EntitiesDamagesData,
    reserves: ReservesPolicyData,
    partyCount: number,
    damageLookups: LookupOption[],
  ): ClaimGroup[] {
    const allEntities = data.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities);
    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const total = reserves.reserves.reduce((s, r) => s + (r.amount ?? 0), 0);
    return [{
      policyNumber: this.policyNumber || '—',
      damageTypes:  damageTypeKeys.map(k => this.label(damageLookups, k)),
      sectionCount: allEntities.length,
      partyCount,
      totalReserve: total,
      currency:     reserves.currency,
    }];
  }

  private buildNonCoveredCases(data: EntitiesDamagesData, damageLookups: LookupOption[]): string[] {
    const notPromised = data.sections.find(s => s.promiseStatus === 'not-promised');
    if (!notPromised) return [];
    return notPromised.damageGroups.slice(0, 1).flatMap(g =>
      g.entities.slice(0, 1).map(e => {
        const dmg = this.label(damageLookups, e.damageTypeKey);
        return `Section 001: ${dmg} of ${e.name} - Case not included in any of client's policies`;
      })
    );
  }

  private label(opts: LookupOption[], key: string | undefined): string {
    if (!key) return '—';
    return opts.find(o => o.value === key)?.label ?? key;
  }

  private formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }
}
