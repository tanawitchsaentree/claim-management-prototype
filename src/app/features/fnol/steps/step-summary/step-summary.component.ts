import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, combineLatest, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { MockSkeletonClaimService } from '../../../../core/mock/services/mock-skeleton-claim.service';
import { MockUserDirectoryService, UserDirectoryEntry } from '../../../../core/mock/services/mock-user-directory.service';
import { EntitiesDamagesData } from '../../../../core/models';
import { ReserveNarrative, ReservesPolicyData } from '../../../../core/models/reserve.model';
import { LookupOption } from '../../../../core/models/lookup.model';
import { AccessListEntry, RESTRICTION_REASONS } from '../../../../core/models/claim-overview.model';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

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

// Creator persona — in real app this comes from AuthService
const CREATOR: AccessListEntry = {
  userId:  'U001',
  name:    'Mara Mustermann',
  role:    'Claims Handler',
  email:   'mara.mustermann@allianz.com',
  addedAt: new Date().toISOString().split('T')[0],
};

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
    NxRadioModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxInputModule,
    WizardFooterComponent,
    EmptyStateComponent,
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
  private readonly userDir      = inject(MockUserDirectoryService);
  private readonly router       = inject(Router);
  private readonly appDate      = new AppDatePipe();

  readonly vm$ = new BehaviorSubject<SummaryViewModel | null>(null);
  loadError  = false;
  submitted  = false;
  private readonly allMockClaimIds = ['CL-2025-001', 'CL-2025-002', 'CL-2025-003'];
  get mockClaimIds(): string[] {
    return this.allMockClaimIds.slice(0, Math.max(1, this.claimGroupCount));
  }

  // ── Restriction form ────────────────────────────────────────────────
  readonly restrictionForm = new FormGroup({
    isRestricted: new FormControl(false),
    reason:       new FormControl<string>('', []),
    otherReason:  new FormControl(''),
  });

  get isRestricted(): boolean { return !!this.restrictionForm.get('isRestricted')?.value; }
  get selectedReason(): string { return this.restrictionForm.get('reason')?.value ?? ''; }
  get isOtherReason(): boolean { return this.selectedReason === 'Other'; }

  readonly restrictionReasons = [...RESTRICTION_REASONS];
  readonly accessList = signal<AccessListEntry[]>([CREATOR]);

  // User search autocomplete
  readonly userSearchControl = new FormControl('');
  readonly userSearchResults = signal<UserDirectoryEntry[]>([]);

  get accessRestricted(): FormControl { return this.restrictionForm.get('isRestricted') as FormControl; }

  readonly recoveryPotential = new FormControl<'yes' | 'no' | null>(null);

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

    // Wire user search
    this.userSearchControl.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => this.userDir.search(q ?? '')),
    ).subscribe(results => {
      // Filter out already-added users
      const addedIds = new Set(this.accessList().map(e => e.userId));
      this.userSearchResults.set(results.filter(u => !addedIds.has(u.userId)));
    });
  }

  onToggleRestriction(checked: boolean): void {
    this.restrictionForm.get('isRestricted')!.setValue(checked);
    if (!checked) {
      this.restrictionForm.get('reason')!.setValue('');
      this.accessList.set([CREATOR]);
    }
  }

  addUserToList(user: UserDirectoryEntry): void {
    const entry: AccessListEntry = {
      userId:  user.userId,
      name:    user.name,
      role:    user.role,
      email:   user.email,
      addedAt: new Date().toISOString().split('T')[0],
    };
    this.accessList.update(list => [...list, entry]);
    this.userSearchControl.setValue('');
    this.userSearchResults.set([]);
  }

  removeUserFromList(userId: string): void {
    // Creator (first entry) cannot be removed
    this.accessList.update(list => list.filter((e, i) => i === 0 || e.userId !== userId));
  }

  onCancel(): void { this.router.navigate(['/dashboard']); }
  onBack(): void   { this.router.navigate(['/fnol/reserves']); }

  async onSubmit(): Promise<void> {
    // Persist restriction state to fnolState so it carries to Claim Overview
    const reason = this.isOtherReason
      ? (this.restrictionForm.get('otherReason')?.value ?? '')
      : this.selectedReason;

    this.fnolState.restriction = {
      isRestricted:  this.isRestricted,
      reason:        this.isRestricted ? reason : undefined,
      restrictedBy:  this.isRestricted ? { userId: CREATOR.userId, name: CREATOR.name } : undefined,
      restrictedAt:  this.isRestricted ? new Date().toISOString().split('T')[0] : undefined,
      accessList:    this.isRestricted ? this.accessList() : [],
    };
    this.fnolState.recoveryPotential = this.recoveryPotential.value ?? null;

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
        causesOfLoss: [], dateOfOccurrence: '—', timeOfOccurrence: '—',
        dateOfNotification: '—', affectedPolicies: [], damageTypes: [],
        claimGroups: [], narrative: null, narrativeReasonLabel: '',
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
    const allEntities = entitiesData.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities);
    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const damageTypes = damageTypeKeys.map(k => this.label(damageLookups, k));
    const lossDateIso = dateOfLoss.get('dateOfOccurrence')?.value as string | null;
    const earliest = this.deriveEarliestSectionDate(lossDateIso, allEntities.length || 3);
    const claimGroups = this.buildClaimGroups(entitiesData, reservesData, parties.length, damageLookups, earliest);
    const narrative = reservesData.narrative && !reservesData.narrative.archivedAt ? reservesData.narrative : null;
    const narrativeReasonLabel = narrative
      ? (narrativeOpts.find(o => o.value === narrative.reasonKey)?.label ?? narrative.reasonKey) : '';

    return {
      causesOfLoss,
      dateOfOccurrence:   earliest.date,
      timeOfOccurrence:   earliest.time,
      dateOfNotification: this.appDate.transform(dateOfLoss.get('dateOfNotification')?.value) || '—',
      affectedPolicies:   [this.policyNumber],
      damageTypes, claimGroups, narrative, narrativeReasonLabel,
      isSkeletonPath: false, skeletonClientName: '—', skeletonReason: '—',
    };
  }

  private buildClaimGroups(
    data: EntitiesDamagesData, reserves: ReservesPolicyData,
    partyCount: number, damageLookups: LookupOption[], earliest: { date: string; time: string },
  ): ClaimGroup[] {
    const allEntities = data.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities);
    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const total = reserves.reserves.reduce((s, r) => s + (r.amount ?? 0), 0);
    const baseGroup: ClaimGroup = {
      policyNumber: this.policyNumber || '—',
      damageTypes: damageTypeKeys.map(k => this.label(damageLookups, k)),
      sectionCount: allEntities.length, partyCount, totalReserve: total,
      currency: reserves.currency,
      earliestSectionDate: earliest.date, earliestSectionTime: earliest.time,
    };
    if ((this.policyNumber ?? '').startsWith('POL-2024-MC')) {
      return this.splitGroupForDemo(baseGroup);
    }
    return [baseGroup];
  }

  private splitGroupForDemo(g: ClaimGroup): ClaimGroup[] {
    const splits = 3;
    const perPartyCount = Math.max(1, Math.floor(g.partyCount / splits));
    const perReserve = Math.round((g.totalReserve / splits) * 100) / 100;
    return Array.from({ length: splits }, (_, i) => ({
      ...g, policyNumber: `${g.policyNumber} · group ${i + 1}`,
      sectionCount: Math.max(1, Math.floor(g.sectionCount / splits)),
      partyCount: perPartyCount, totalReserve: perReserve,
    }));
  }

  private deriveEarliestSectionDate(lossDateIso: string | null, sectionHint: number): { date: string; time: string } {
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
}
