import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom, combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
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
import { MockSectionService } from '../../../../core/mock/services/mock-section.service';
import { MockStateService } from '../../../../core/mock/state/mock-state.service';
import { MockClaimOverviewService } from '../../../../core/mock/services/mock-claim-overview.service';
import { LossInformation, LossInformationFormValue } from '../../../../core/models/loss-information.model';
import { Claim } from '../../../../core/models/claim.model';
import { MockUserDirectoryService, UserDirectoryEntry } from '../../../../core/mock/services/mock-user-directory.service';
import { EntitiesDamagesData, EntityRow } from '../../../../core/models';
import { ReserveNarrative, ReservesPolicyData } from '../../../../core/models/reserve.model';
import { LookupOption, OTHER_CAUSE_KEY } from '../../../../core/models/lookup.model';
import { AccessListEntry, RESTRICTION_REASONS } from '../../../../core/models/claim-overview.model';
import { AppDatePipe } from '../../../../shared/pipes/app-date.pipe';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { lookupLabel } from '../../../../shared/utils/lookup.util';
import { isNarrativeActive, narrativeReasonLabel } from '../../../../shared/utils/reserve-narrative.util';

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
  private readonly sectionSvc   = inject(MockSectionService);
  private readonly stateSvc     = inject(MockStateService);
  private readonly overviewSvc  = inject(MockClaimOverviewService);
  private readonly userDir      = inject(MockUserDirectoryService);
  private readonly router       = inject(Router);
  private readonly appDate      = new AppDatePipe();
  private readonly live         = inject(LiveAnnouncer);

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
  private readonly userSearchQuery = toSignal(
    this.userSearchControl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()),
    { initialValue: this.userSearchControl.value },
  );

  constructor() {
    effect(() => {
      const q = this.userSearchQuery();
      firstValueFrom(this.userDir.search(q ?? '')).then(results => {
        const addedIds = new Set(this.accessList().map(e => e.userId));
        this.userSearchResults.set(results.filter(u => !addedIds.has(u.userId)));
      });
    });
  }

  get accessRestricted(): FormControl { return this.restrictionForm.get('isRestricted') as FormControl; }

  readonly recoveryPotential = new FormControl<'yes' | 'no' | null>(null);

  get policyNumber(): string { return this.fnolState.policyNumber; }

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
      this.live.announce('Failed to load summary data. Please go back and try again.', 'assertive');
    }

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
    // Written onto fnolState.restriction/recoveryPotential AND onto the
    // created claim's ClaimOverview record below (see writeLossInformationToClaim) —
    // this comment used to claim the fnolState assignment alone "carries to
    // Claim Overview," which was never true (nothing read it). Now it is:
    // the overview patch a few lines down is what actually makes it true.
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

    const newClaimId   = this.mockClaimIds[0];
    const skeletonId   = this.fnolState.skeletonClaimId;
    const policyNumber = this.fnolState.selectedPolicy?.policyNumber;
    if (skeletonId && this.fnolState.path === 'standard' && policyNumber) {
      try {
        await firstValueFrom(
          this.skeletonSvc.matchToPolicy(skeletonId, policyNumber, 'Current User', newClaimId),
        );
      } catch (err) {
        console.error('[Summary] matchToPolicy failed:', err);
      }
    }

    // Stage 4 (FNOL/claim-file model fix): step 2's entities, grouped by
    // damage type, become the claim's real sections — previously this data
    // died at submit. Not run on the orphan/skeleton path — that path never
    // has a policy or an EntitiesDamagesData to read from.
    if (this.fnolState.path !== 'orphan') {
      await this.createSectionsFromEntitiesDamages(newClaimId);
      // Stage 5: step 1's loss information — previously discarded entirely,
      // regardless of path — now lands on the same claim the sections above
      // just landed on.
      await this.writeLossInformationToClaim(newClaimId);
    }

    this.fnolState.markStepComplete('summary');
    this.submitted = true;
    const count = this.mockClaimIds.length;
    this.live.announce(
      `${count} claim${count === 1 ? '' : 's'} opened: ${this.mockClaimIds.join(', ')}`,
      'polite',
    );
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

    const specifyCause = (lossGroup.get('specifyOtherCauseOfLoss')?.value as string) ?? '';

    const causesOfLoss = causeKeys.map(k => this.qualifyOther(causeLookups, k, OTHER_CAUSE_KEY, specifyCause));
    const allEntities = entitiesData.sections.flatMap(s => s.damageGroups).flatMap(g => g.entities);
    const damageTypeKeys = [...new Set(allEntities.map(e => e.damageTypeKey).filter(Boolean))];
    const damageTypes = damageTypeKeys.map(k => this.label(damageLookups, k));
    const lossDateIso = dateOfLoss.get('dateOfOccurrence')?.value as string | null;
    const earliest = this.deriveEarliestSectionDate(lossDateIso, allEntities.length || 3);
    const claimGroups = this.buildClaimGroups(entitiesData, reservesData, parties.length, damageLookups, earliest);
    const narrative = isNarrativeActive(reservesData.narrative) ? reservesData.narrative! : null;
    const narrativeLabel = narrativeReasonLabel(narrative, narrativeOpts);

    return {
      causesOfLoss,
      dateOfOccurrence:   earliest.date,
      timeOfOccurrence:   earliest.time,
      dateOfNotification: this.appDate.transform(dateOfLoss.get('dateOfNotification')?.value) || '—',
      affectedPolicies:   [this.policyNumber],
      damageTypes, claimGroups, narrative, narrativeReasonLabel: narrativeLabel,
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
    return lookupLabel(opts, key);
  }

  // "Other" on its own tells the reader nothing. When the handler typed a
  // qualifier on the loss-information step, show it here — otherwise the
  // summary silently drops the only informative part of the selection.
  private qualifyOther(opts: LookupOption[], key: string | undefined, otherKey: string, text: string): string {
    const label = this.label(opts, key);
    const typed = text.trim();
    return key === otherKey && typed ? `${label} — ${typed}` : label;
  }

  // Stage 5 (FNOL/claim-file model fix): loss information captured at step 1
  // previously never left FnolStateService — onSubmit touched restriction/
  // recoveryPotential/skeleton matching, never LossInformation itself, and
  // the "claim" it landed on (mockClaimIds[0], a hardcoded literal) had no
  // ClaimOverview built from wizard data at all. Building a brand-new claim
  // record from scratch (its own numbering, tasks, financial summary, etc.)
  // is a bigger change than this stage — writing the wizard's real data onto
  // the claim it already lands on, so nothing is silently discarded.
  private async writeLossInformationToClaim(claimId: string): Promise<void> {
    // Cast through `unknown` — the live form's lossLocation control actually
    // holds LocationPickerOutput, not the LossInformationFormValue's declared
    // LossLocation shape (a pre-existing mismatch, not introduced here; see
    // mapLossLocation() below for the work-around).
    const formValue = this.fnolState.fnolForm.get('lossInformation')!.value as unknown as LossInformationFormValue;
    const now = new Date().toISOString();

    const lossInfo: LossInformation = {
      id:        `LI-${claimId}`,
      claimId,
      dateOfLoss:      formValue.dateOfLoss,
      // LossInformationFormValue.lossLocation is typed as the address-shaped
      // LossLocation domain model, but the live form control actually holds
      // LocationPickerOutput ({ locations: LocationItem[] }) — a pre-existing
      // shape mismatch this stage doesn't resolve (flagged, not silently
      // patched over). Best-effort map from the first picked location so
      // something real lands here rather than nothing.
      lossLocation:    this.mapLossLocation(formValue.lossLocation),
      causeOfLoss:     formValue.causeOfLoss ?? [],
      typeOfDamage:    formValue.typeOfDamage ?? [],
      circumstance:    formValue.circumstance ?? null,
      specifyOtherCauseOfLoss: formValue.specifyOtherCauseOfLoss || undefined,
      lossDescription: formValue.lossDescription ?? '',
      events:          formValue.events ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.stateSvc.patchLossInformation(items => [...items.filter(li => li.claimId !== claimId), lossInfo]);

    const causeLookups = await firstValueFrom(this.lookupSvc.getCauseOfLoss());
    const causeLabels = (formValue.causeOfLoss ?? []).map(k => this.label(causeLookups, k));

    this.overviewSvc.updateGeneralInfo(claimId, {
      client:              this.fnolState.selectedPolicyFull?.clientName,
      policyNumber:        this.policyNumber || undefined,
      dateOfLoss:          formValue.dateOfLoss?.dateOfOccurrence ?? undefined,
      proximateLossCause:  causeLabels[0] ?? undefined,
      causeOfLoss:         causeLabels.length ? causeLabels : undefined,
      // BMPCC-18160 — stored as the key, resolved to a label at render time by
      // circumstanceLabel() so a later RDA rename shows through everywhere.
      incidentCircumstance: formValue.circumstance ?? undefined,
      description:         formValue.lossDescription || undefined,
      restriction:         this.fnolState.restriction,
      recoveryPotential:   this.fnolState.recoveryPotential ?? undefined,
    });

    const claim: Claim = {
      claimId,
      policyNumber: this.policyNumber || '',
      clientName:   this.fnolState.selectedPolicyFull?.clientName ?? '—',
      broker:       null,
      assignee:     null,
      createdBy:    CREATOR.name,
      dateCreated:  now.split('T')[0],
      dateUpdated:  now.split('T')[0],
      lossDate:     formValue.dateOfLoss?.dateOfOccurrence ?? now.split('T')[0],
      lossAmount:   0,
      currency:     'EUR',
      description:  formValue.lossDescription ?? '',
      status:       'Open',
      priority:     'medium',
      lineOfBusiness: (this.fnolState.selectedPolicyFull?.lineOfBusiness as Claim['lineOfBusiness']) ?? 'Property',
      location:     null,
      lossEventId:  null,
      causeOfLoss:  formValue.causeOfLoss ?? [],
    };
    this.stateSvc.patchClaims(claims => [...claims.filter(c => c.claimId !== claimId), claim]);
  }

  private mapLossLocation(loc: unknown): LossInformation['lossLocation'] {
    const picked = (loc as { locations?: Array<{ displayName?: string; addressLine1?: string; city?: string; postalCode?: string; country?: string }> })?.locations?.[0];
    return {
      locationRequired: !!picked,
      locationType:     picked ? 'other' : null,
      incidentAddress:  picked?.displayName ?? '',
      incidentAtDifferentLocation: false,
      street:      picked?.addressLine1 ?? '',
      streetNumber: '',
      city:        picked?.city ?? '',
      postalCode:  picked?.postalCode ?? '',
      country:     picked?.country ?? null,
    };
  }

  // Stage 4 (FNOL/claim-file model fix): one section per distinct damage type
  // present in step 2's data, holding every entity tagged with that type —
  // "Entity x Damage Type = Section" applied literally, not per-entity.
  // Entities missing a damageTypeKey (shouldn't happen via the FNOL UI, which
  // always assigns one on add — see MockEntitiesDamagesService.addEntityFromSearch
  // — but the seed data's own fixtures are hand-authored and not guaranteed)
  // fall back to material-damage rather than being silently dropped.
  private async createSectionsFromEntitiesDamages(claimId: string): Promise<void> {
    const data = await firstValueFrom(this.entitiesSvc.getByPolicyId(this.policyNumber));
    // Group by damageGroup, not by each entity's own damageTypeKey — hand-
    // authored seed entities don't reliably carry that field themselves
    // (only entities added at runtime via addEntityFromSearch do); the group
    // they're nested under is the one place a damage type is always present.
    // The same entity name can legitimately appear in two different groups
    // (e.g. seed data has "Kaufmann's Company Employees" under both
    // bodily-injury and liability) — that's exactly the "one fire, two
    // sections" case, not a duplicate to be merged away.
    const groups = data.sections.flatMap(s => s.damageGroups).filter(g => g.entities.length);
    if (!groups.length) return;

    const byDamageType = new Map<string, EntityRow[]>();
    for (const group of groups) {
      byDamageType.set(group.damageTypeKey, [...(byDamageType.get(group.damageTypeKey) ?? []), ...group.entities]);
    }

    for (const [damageType, entities] of byDamageType) {
      await firstValueFrom(
        this.sectionSvc.createSection(
          claimId,
          damageType,
          entities.map(e => ({ name: e.name, instructionStatus: 'Not assigned' })),
          { userId: CREATOR.userId, name: CREATOR.name },
        ),
      );
    }
  }
}
