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
  earliestSectionDate: string;
  earliestSectionTime: string;
}

export interface SummaryViewModel {
  causesOfLoss: string[];
  dateOfOccurrence: string;
  timeOfOccurrence: string;
  dateOfNotification: string;
  affectedPolicies: string[];
  damageTypes: string[];
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
  private readonly allMockClaimIds = ['CL-2025-001', 'CL-2025-002', 'CL-2025-003'];
  get mockClaimIds(): string[] {
    return this.allMockClaimIds.slice(0, Math.max(1, this.claimGroupCount));
  }
  accessRestricted = new FormControl(false);

  get policyNumber(): string { return this.fnolState.selectedPolicy?.policyNumber ?? ''; }

  async ngOnInit(): Promise<void> {
    const isOrphan = this.fnolState.path === 'orphan';

    const validSkeleton = isOrphan && this.fnolState.selectedClient;
    const validStandard = !isOrphan && this.fnolState.selectedPolicy;
    if (!validSkeleton && !validStandard) { this.router.navigate(['/fnol/search']); return; }

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

  // Start Claim post-submit nav: 1 group → claim overview, >1 → loss-event overview, 0 → disabled.
  get claimGroupCount(): number { return this.vm$.value?.claimGroups.length ?? 0; }
  get startClaimDisabled(): boolean { return this.claimGroupCount === 0; }
  get startClaimTooltip(): string {
    if (this.claimGroupCount === 0) return 'No claim groups derived — review entities & damages.';
    if (this.claimGroupCount > 1) return 'Multiple claims detected — opens the Loss Event Overview.';
    return '';
  }

  onStartClaim(): void {
    const count = this.claimGroupCount;
    if (count === 0) return;
    if (count === 1) {
      this.router.navigate(['/claims', this.mockClaimIds[0], 'overview']);
      return;
    }
    const lossEventId = `LE-${this.mockClaimIds[0]?.replace(/^CL-/, '') ?? '2025-001'}`;
    this.router.navigate(['/loss-events', lossEventId, 'overview']);
  }

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

    const lossDateIso = dateOfLoss.get('dateOfOccurrence')?.value as string | null;

    // Change 1: Proximate Loss date/time = EARLIEST across all claim sections.
    // Single source of truth — General data "Date of loss" and the accordion
    // "Earliest section date" both read this same computation.
    const earliest = this.deriveEarliestSectionDate(lossDateIso, allEntities.length || 3);

    const claimGroups = this.buildClaimGroups(
      entitiesData, reservesData, parties.length, damageLookups, earliest,
    );

    const narrative = reservesData.narrative && !reservesData.narrative.archivedAt
      ? reservesData.narrative : null;
    const narrativeReasonLabel = narrative
      ? (narrativeOpts.find(o => o.value === narrative.reasonKey)?.label ?? narrative.reasonKey)
      : '';

    return {
      causesOfLoss,
      dateOfOccurrence:   earliest.date,
      timeOfOccurrence:   earliest.time,
      dateOfNotification: this.formatDate(dateOfLoss.get('dateOfNotification')?.value),
      affectedPolicies:   [this.policyNumber],
      damageTypes,
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
    earliest: { date: string; time: string },
  ): ClaimGroup[] {
    const allEntities = data.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities);
    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const total = reserves.reserves.reduce((s, r) => s + (r.amount ?? 0), 0);

    const baseGroup: ClaimGroup = {
      policyNumber: this.policyNumber || '—',
      damageTypes:  damageTypeKeys.map(k => this.label(damageLookups, k)),
      sectionCount: allEntities.length,
      partyCount,
      totalReserve: total,
      currency:     reserves.currency,
      earliestSectionDate: earliest.date,
      earliestSectionTime: earliest.time,
    };

    // Demo-only multi-claim split (policy prefix "POL-2024-MC") so Start Claim
    // → loss-event-overview can be exercised. Real backend groups by coverage.
    if ((this.policyNumber ?? '').startsWith('POL-2024-MC')) {
      const split = this.splitGroupForDemo(baseGroup);
      return split;
    }

    return [baseGroup];
  }

  private splitGroupForDemo(g: ClaimGroup): ClaimGroup[] {
    const splits = 3;
    const perPartyCount = Math.max(1, Math.floor(g.partyCount / splits));
    const perReserve = Math.round((g.totalReserve / splits) * 100) / 100;
    return Array.from({ length: splits }, (_, i) => ({
      ...g,
      policyNumber: `${g.policyNumber} · group ${i + 1}`,
      sectionCount: Math.max(1, Math.floor(g.sectionCount / splits)),
      partyCount: perPartyCount,
      totalReserve: perReserve,
    }));
  }

  private deriveEarliestSectionDate(
    lossDateIso: string | null, sectionHint: number,
  ): { date: string; time: string } {
    if (!lossDateIso) return { date: '—', time: '—' };
    const base = new Date(`${lossDateIso}T00:00:00`);
    if (Number.isNaN(base.getTime())) return { date: '—', time: '—' };
    const count = Math.min(5, Math.max(3, sectionHint));
    let minOffset = Number.POSITIVE_INFINITY;
    for (let i = 0; i < count; i++) {
      const m = ((i * 137) + 19) % (24 * 60);
      if (m < minOffset) minOffset = m;
    }
    const e = new Date(base.getTime() + minOffset * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${pad(e.getDate())}-${pad(e.getMonth() + 1)}-${e.getFullYear()}`,
      time: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
    };
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
