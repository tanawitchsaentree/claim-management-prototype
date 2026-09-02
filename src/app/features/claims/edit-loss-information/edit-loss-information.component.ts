import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { MockLossInformationService } from '../../../core/mock/services/mock-loss-information.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { MockSectionService } from '../../../core/mock/services/mock-section.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import { LossInformation, LossInformationFormValue } from '../../../core/models/loss-information.model';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { ClaimSection } from '../../../core/models/section.model';
import { LocationPickerOutput, OTHER_CAUSE_KEY } from '../../../core/models';
import { futureDateValidator, dateOrderValidator } from '../../../shared/validators/date.validators';
import { LossInfoConfirmModalComponent, LossInfoConfirmModalData } from './loss-info-confirm-modal.component';
import { LossInfoDiscardModalComponent } from './loss-info-discard-modal.component';
import { ImpactedSectionsWarningComponent } from './impacted-sections-warning.component';
import { SectionImpact, computeSectionImpacts } from './impacted-sections';
import {
  IMPACT_LABELS,
  LABEL_TO_FIELD_KEY,
  VALIDATED_FIELDS,
  LossInfoDiffField,
  computeLossInfoDiffs,
} from './loss-info-diff';

type SpecifyOtherKey = 'specifyOtherCauseOfLoss';

@Component({
  selector: 'app-edit-loss-information',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    NxButtonModule, NxIconModule, NxFormfieldModule, NxInputModule,
    NxTimefieldModule, NxDatefieldModule,
    NxDropdownModule, NxMultiSelectComponent, NxLinkModule,
    NxMessageModule, NxModalModule, NxSpinnerModule,
    LocationPickerComponent,
    PageHeaderComponent,
    StatusChipComponent,
    ImpactedSectionsWarningComponent,
  ],
  templateUrl: './edit-loss-information.component.html',
  styleUrl: './edit-loss-information.component.scss',
})
export class EditLossInformationComponent implements OnInit {
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly lossInfoSvc  = inject(MockLossInformationService);
  private readonly lookupSvc    = inject(MockLookupService);
  private readonly overviewSvc  = inject(MockClaimOverviewService);
  private readonly sectionSvc   = inject(MockSectionService);
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly toast        = inject(ToastService);
  private readonly live         = inject(LiveAnnouncer);

  readonly claimId      = signal<string>('');
  readonly clientName   = signal<string>('');
  readonly claimStatus  = signal<string>('');
  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly saveSuccess  = signal(false);
  /** Why the last Save attempt refused — see revealFirstInvalid(). */
  readonly saveBlocked  = signal<string | null>(null);
  readonly original     = signal<LossInformation | null>(null);
  readonly policyNumber = signal<string | null>(null);
  readonly maxDesc   = 500;
  submitAttempted    = false;

  // ── Own FormGroup — isolated from FNOL wizard ────────────────────────
  readonly form = new FormGroup({
    dateOfLoss: new FormGroup({
      dateOfOccurrence:   new FormControl<string | null>(null, [Validators.required, futureDateValidator]),
      timeOfOccurrence:   new FormControl<string | null>(null, [Validators.required]),
      dateOfNotification: new FormControl<string | null>(null, [Validators.required, futureDateValidator]),
      timeOfNotification: new FormControl<string | null>(null, [Validators.required]),
    }, { validators: dateOrderValidator }),
    lossLocation:    new FormControl<LocationPickerOutput>({ locations: [] }),
    causeOfLoss:     new FormControl<string[]>([], []),
    // Added 2026-08-31 (Marlene feedback) — was FNOL-only until now; the
    // LossInformation model/service already carried typeOfDamage end to end,
    // this form just never exposed it. This is the field IMPACT_LABELS'
    // 'Type of damages' entry and the confirm-modal's damage warning banner
    // were built for (see loss-info-confirm-modal.component.ts's
    // damageChanged()) but had no way to ever actually fire until now.
    typeOfDamage:    new FormControl<string[]>([], []),
    // Free-text qualifier for the "Other Event" cause. The validator is
    // attached at runtime by syncSpecifyOther() because "required" depends on
    // whether causeOfLoss currently includes that value. typeOfDamage has no
    // counterpart by design — see OTHER_CAUSE_KEY in core/models/lookup.model.ts.
    specifyOtherCauseOfLoss: new FormControl<string>(''),
    lossDescription: new FormControl('', [Validators.required, Validators.maxLength(500)]),
  });

  get dateOfLoss()   { return this.form.get('dateOfLoss') as FormGroup; }
  get lossLocation() { return this.form.get('lossLocation') as FormControl<LocationPickerOutput>; }

  // ── Lookups ──────────────────────────────────────────────────────────
  readonly causeOfLossOptions$  = this.lookupSvc.getCauseOfLoss();
  readonly causeOfLossOptions   = toSignal(this.causeOfLossOptions$, { initialValue: [] });
  readonly typeOfDamageOptions$ = this.lookupSvc.getTypeOfDamage();
  readonly typeOfDamageOptions  = toSignal(this.typeOfDamageOptions$, { initialValue: [] });

  get selectedCauses(): string[]  { return (this.form.get('causeOfLoss')?.value  as string[]) ?? []; }
  get selectedDamages(): string[] { return (this.form.get('typeOfDamage')?.value as string[]) ?? []; }

  // `specify` folds the typed qualifier into the "Other" entry — reading back
  // "Other" alone would hide the only part of that selection that says anything.
  private causeLabelsFor(keys: string[], specify = ''): string {
    if (!keys.length) return '';
    const opts = this.causeOfLossOptions();
    return keys
      .map(k => this.qualify(opts.find(o => o.value === k)?.label ?? k, k === OTHER_CAUSE_KEY, specify))
      .join(', ');
  }

  private damageLabelsFor(keys: string[]): string {
    if (!keys.length) return '';
    const opts = this.typeOfDamageOptions();
    return keys.map(k => opts.find(o => o.value === k)?.label ?? k).join(', ');
  }

  private qualify(label: string, isOther: boolean, specify: string): string {
    const typed = specify.trim();
    return isOther && typed ? `${label} — ${typed}` : label;
  }

  private specifyValue(key: SpecifyOtherKey): string {
    return (this.form.get(key)?.value as string) ?? '';
  }

  get causeOfLossDisplay(): string {
    return this.causeLabelsFor(this.selectedCauses, this.specifyValue('specifyOtherCauseOfLoss'));
  }

  get typeOfDamageDisplay(): string { return this.damageLabelsFor(this.selectedDamages); }

  get showSpecifyOtherCause(): boolean { return this.selectedCauses.includes(OTHER_CAUSE_KEY); }

  onCauseOfLossChange(selected: string[]): void {
    this.syncSpecifyOther('specifyOtherCauseOfLoss', selected.includes(OTHER_CAUSE_KEY));
  }

  // Clearing the value on hide matters here as much as on FNOL: a hidden
  // control holding stale text would keep the Save button gated with nothing
  // on screen to fix, and would show up as a phantom pending change.
  private syncSpecifyOther(key: SpecifyOtherKey, needed: boolean): void {
    const ctrl = this.form.get(key);
    if (!ctrl) return;
    if (needed) {
      ctrl.setValidators([Validators.required, Validators.maxLength(100)]);
    } else {
      ctrl.clearValidators();
      if (ctrl.value) ctrl.setValue('');
    }
    ctrl.updateValueAndValidity();
  }

  // ── Read/edit field state ─────────────────────────────────────────────
  // Single field open at a time by default — no confirmed research on whether
  // users need multiple fields open simultaneously; this is the documented
  // default from the review spec, not a resolved product decision.
  readonly editingField = signal<string | null>(null);
  isEditing(key: string): boolean { return this.editingField() === key; }
  startEdit(key: string): void { this.editingField.set(key); }
  closeEdit(): void { this.editingField.set(null); }

  readonly isDirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), { initialValue: false });

  // Reactive diff list — the confirm-modal payload, the change ledger, the
  // header counter, and the Save-button gate all read from this one signal
  // instead of four separate ad-hoc checks.
  private readonly formSnapshot = toSignal(
    this.form.valueChanges.pipe(startWith(null)),
    { initialValue: null },
  );
  readonly pendingChanges = computed<LossInfoDiffField[]>(() => {
    this.formSnapshot(); // form.valueChanges fires for every control in this.form
    return this.computeDiffs();
  });

  readonly hasHighImpactChange = computed(() =>
    this.pendingChanges().some(d => IMPACT_LABELS.includes(d.label)),
  );

  /** Open sections of this claim — the input to impactedSections(). */
  readonly sections = signal<ClaimSection[]>([]);

  // Which sections these pending updates hit, named, before Confirm (Marlene
  // feedback, 2026-09-01). Recomputes with pendingChanges(), so the warning
  // appears and disappears as the user edits rather than only on save.
  readonly impactedSections = computed<SectionImpact[]>(() => {
    const diffs = this.pendingChanges();
    if (!diffs.length) return [];
    return computeSectionImpacts({
      sections: this.sections(),
      originalDamageKeys: this.original()?.typeOfDamage ?? [],
      updatedDamageKeys: this.selectedDamages,
      damageLabel: k => this.typeOfDamageOptions().find(o => o.value === k)?.label ?? k,
      changedLabels: diffs.map(d => d.label),
    });
  });

  // ── Lifecycle ────────────────────────────────────────────────────────
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.claimId.set(id);

    firstValueFrom(this.lossInfoSvc.getByClaimId(id)).then(li => {
      this.loading.set(false);
      if (li) {
        this.original.set(li);
        this.prefillForm(li);
      }
    });

    firstValueFrom(this.sectionSvc.getByClaimId(id)).then(sections => this.sections.set(sections));

    firstValueFrom(this.overviewSvc.getOverview(id)).then(claim => {
      this.policyNumber.set(claim?.policyNumber ?? null);
      this.clientName.set(claim?.client ?? '');
      this.claimStatus.set(claim?.status ?? '');
    });
  }

  private prefillForm(li: LossInformation): void {
    this.dateOfLoss.patchValue({
      dateOfOccurrence:   li.dateOfLoss?.dateOfOccurrence   ?? null,
      timeOfOccurrence:   li.dateOfLoss?.timeOfOccurrence   ?? null,
      dateOfNotification: li.dateOfLoss?.dateOfNotification ?? null,
      timeOfNotification: li.dateOfLoss?.timeOfNotification ?? null,
    });
    this.form.patchValue({
      causeOfLoss:     li.causeOfLoss     ?? [],
      typeOfDamage:    li.typeOfDamage    ?? [],
      specifyOtherCauseOfLoss: li.specifyOtherCauseOfLoss ?? '',
      lossDescription: li.lossDescription ?? '',
      lossLocation:    (li.lossLocation as unknown as LocationPickerOutput) ?? { locations: [] },
    });
    // Reconcile the runtime validator against what was just loaded — no
    // selectionChange fires on a patchValue, so this is the only chance.
    this.syncSpecifyOther('specifyOtherCauseOfLoss', this.showSpecifyOtherCause);
    this.editingField.set(!li.causeOfLoss?.length ? 'causeOfLoss' : null);
    this.form.markAsPristine();
  }

  // ── "was" display, per field group ────────────────────────────────────
  get originalCauseOfLossDisplay(): string {
    const o = this.original();
    return this.causeLabelsFor(o?.causeOfLoss ?? [], o?.specifyOtherCauseOfLoss ?? '') || 'Not provided';
  }

  get originalTypeOfDamageDisplay(): string {
    const o = this.original();
    return this.damageLabelsFor(o?.typeOfDamage ?? []) || 'Not provided';
  }

  private formatDateTime(date?: string | null, time?: string | null): string {
    if (!date) return 'Not provided';
    return time ? `${date} ${time}` : date;
  }

  get dateGroupDisplay(): string {
    const v = this.dateOfLoss.getRawValue();
    const occ = this.formatDateTime(v.dateOfOccurrence, v.timeOfOccurrence);
    const notif = this.formatDateTime(v.dateOfNotification, v.timeOfNotification);
    return `Occurred: ${occ} · Reported: ${notif}`;
  }

  get originalDateGroupDisplay(): string {
    const o = this.original();
    const occ = this.formatDateTime(o?.dateOfLoss?.dateOfOccurrence, o?.dateOfLoss?.timeOfOccurrence);
    const notif = this.formatDateTime(o?.dateOfLoss?.dateOfNotification, o?.dateOfLoss?.timeOfNotification);
    return `Occurred: ${occ} · Reported: ${notif}`;
  }

  get originalLossLocationDisplay(): string {
    const loc = (this.original()?.lossLocation as { locations?: { displayName?: string }[] } | null)?.locations?.[0]?.displayName;
    return loc || 'Not provided';
  }

  fieldChanged(key: string): boolean {
    return this.pendingChanges().some(d => LABEL_TO_FIELD_KEY[d.label] === key);
  }

  // ── Diff computation ─────────────────────────────────────────────────
  // Lives in loss-info-diff.ts — pure, so it is unit-testable without a
  // TestBed and the component stops growing.
  private computeDiffs(): LossInfoDiffField[] {
    return computeLossInfoDiffs(
      this.original(),
      this.form.getRawValue() as unknown as LossInformationFormValue,
    );
  }

  // ── Save flow ─────────────────────────────────────────────────────────
  async onSaveChanges(): Promise<void> {
    this.submitAttempted = true;
    this.saveBlocked.set(null);
    if (this.form.invalid) {
      this.revealFirstInvalid();
      return;
    }

    const diffs = this.pendingChanges();
    if (!diffs.length) return;

    // Modal calibration: fire only when a high-impact field changed. A
    // low-impact-only change set (e.g. just the description) saves straight
    // through — the header's change ledger already showed the user what was
    // about to happen, so a modal here would be a barrier nobody reads.
    if (this.hasHighImpactChange()) {
      const data: LossInfoConfirmModalData = {
        claimId: this.claimId(),
        diffs,
        impacts: this.impactedSections(),
      };
      const ref = this.dialogSvc.open(LossInfoConfirmModalComponent, { data, width: '600px', maxWidth: '92vw' });
      const result = await firstValueFrom(ref.afterClosed());
      if (result !== 'confirmed') return;
    }

    this.saveSuccess.set(false);
    this.saving.set(true);
    const formValue = this.form.getRawValue() as unknown as LossInformationFormValue;
    try {
      await firstValueFrom(this.lossInfoSvc.save(formValue, this.claimId()));

      // Write activity log entries for changed fields
      const activities: ClaimActivity[] = diffs.map((d, i) => ({
        id:         `act-edit-${Date.now()}-${i}`,
        claimId:    this.claimId(),
        user:       'Current User',
        timestamp:  new Date().toISOString(),
        objectType: 'Loss Information',
        attribute:  d.label,
        valueOld:   d.original || null,
        valueNew:   d.updated  || null,
      }));

      if (activities.length) {
        this.overviewSvc.appendActivities?.(this.claimId(), activities);
      }

      // Claim Overview shows its own dateOfLoss/proximateLossCause fields —
      // separate from the LossInformation record this form edits. Without
      // this, the overview page (and any downstream copy of the claim, e.g.
      // its financial and reference-panel summaries) keeps showing the
      // original date/cause after an investigation reveals the real ones.
      await this.syncOverviewFromLossInfo(formValue, diffs);

      // pendingChanges() compares live form values against these two snapshots,
      // independently of form.dirty — without updating them post-save, the
      // ledger (and the canDeactivate guard) would still see the just-saved
      // values as "pending", firing the leave-confirmation on the very
      // navigate() call below.
      this.original.set({ ...(this.original() as LossInformation), ...formValue } as LossInformation);

      this.form.markAsPristine();
      this.saveSuccess.set(true);
      this.live.announce('Loss information updated successfully.', 'polite');

      // ClaimSection/SectionEntity still carry no structured link back to a
      // cause-of-loss or location key — there is no reliable way to tell
      // which existing sections a change actually affects, even after the
      // FNOL/claim-file model work (ClaimSection.damageType has no
      // relationship to causeOfLoss anywhere). Treat cause-of-loss OR
      // location changes as sections-impacting and send the user to review
      // manually, per the Miro flow ("triggers changes to existing sections" →
      // notify + redirect). Signed off 2026-08-18 — see CONVERSIONS.md.
      //
      // The redirect used to carry nothing — Sections looked identical to a
      // plain nav-bar visit, and a toast said the same thing the review
      // banner below now says, less usefully and with a 4s expiry. Passing
      // what changed (old/new values) as query params — the same mechanism
      // sections.ts already uses to hand a highlight to Provider Management
      // via ?sectionId= — replaces the toast on this path entirely.
      const impactedDiffs = diffs.filter(d => IMPACT_LABELS.includes(d.label));
      if (impactedDiffs.length) {
        this.router.navigate(['/claims', this.claimId(), 'sections'], {
          queryParams: {
            changedFields: impactedDiffs.map(d => d.label),
            changedOld:    impactedDiffs.map(d => d.original),
            changedNew:    impactedDiffs.map(d => d.updated),
          },
        });
      } else {
        this.toast.success('Loss information updated', `${activities.length} field(s) updated on ${this.claimId()}`);
        this.router.navigate(['/claims', this.claimId(), 'overview']);
      }
    } catch {
      this.toast.error('Failed to save', 'Please try again. Your updates have been kept.');
      // Form stays dirty — user remains on edit screen to retry.
    } finally {
      this.saving.set(false);
    }
  }

  // Names the incomplete fields and reopens the first group that holds one, so
  // a refused Save is explainable on screen instead of a dead button.
  private revealFirstInvalid(): void {
    const incomplete = VALIDATED_FIELDS.filter(t => this.form.get(t.path)?.invalid);
    const labels = incomplete.map(t => t.label);
    if (this.dateOfLoss.errors?.['dateOrder']) {
      labels.push('Notification date must be on or after date of occurrence');
    }
    this.saveBlocked.set(
      labels.length
        ? `Can't save yet — check ${labels.join(', ')}.`
        : "Can't save yet — some details are still incomplete.",
    );
    this.editingField.set(incomplete[0]?.field ?? 'dateGroup');
    this.form.markAllAsTouched();
    this.live.announce(this.saveBlocked()!, 'assertive');
  }

  private async syncOverviewFromLossInfo(formValue: LossInformationFormValue, diffs: LossInfoDiffField[]): Promise<void> {
    const patch: { dateOfLoss?: string; proximateLossCause?: string; causeOfLoss?: string[] } = {};

    if (diffs.some(d => d.label === 'Date of occurrence') && formValue.dateOfLoss?.dateOfOccurrence) {
      patch.dateOfLoss = formValue.dateOfLoss.dateOfOccurrence;
    }
    if (diffs.some(d => d.label === 'Cause of loss')) {
      // proximateLossCause stays a single "headline" value (the first cause)
      // for compact summaries — causeOfLoss carries every cause so the
      // Reference Panel and any other detail view can show the full list
      // instead of silently only ever showing the first one.
      const causeKeys = formValue.causeOfLoss ?? [];
      const causeLabels = causeKeys.map(k => this.causeOfLossOptions().find(o => o.value === k)?.label ?? k);
      patch.proximateLossCause = causeLabels[0] ?? '–';
      patch.causeOfLoss = causeLabels;
    }

    if (Object.keys(patch).length) {
      await firstValueFrom(this.overviewSvc.updateGeneralInfo(this.claimId(), patch));
    }
  }

  // ── Discard / leave flow ───────────────────────────────────────────────
  // Shared by the Discard button and the canDeactivate route guard — the
  // guard controls whether navigation (to wherever the user was headed)
  // proceeds; it must not force a redirect of its own.
  async confirmLeaveIfDirty(): Promise<boolean> {
    if (!this.pendingChanges().length) return true;
    const ref = this.dialogSvc.open(LossInfoDiscardModalComponent, { width: '440px' });
    const result = await firstValueFrom(ref.afterClosed());
    return result === 'discard';
  }

  async onDiscard(): Promise<void> {
    const canLeave = await this.confirmLeaveIfDirty();
    if (canLeave) this.router.navigate(['/claims', this.claimId(), 'overview']);
  }

  // Covers the case the router guard can't: an actual tab close/refresh/
  // address-bar navigation. The guard only intercepts in-app routing.
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.pendingChanges().length > 0) {
      event.preventDefault();
      event.returnValue = true;
    }
  }
}
