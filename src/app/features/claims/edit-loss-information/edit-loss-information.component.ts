import { Component, HostListener, OnInit, inject, signal, computed } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  AbstractControl,
  Validators
} from '@angular/forms';
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
import { NxBadgeModule } from '@allianz/ng-aquila/badge';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { MockLossInformationService } from '../../../core/mock/services/mock-loss-information.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import {
  LossInformation,
  LossInformationFormValue
} from '../../../core/models/loss-information.model';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { LocationPickerOutput, LookupOption, OTHER_CAUSE_KEY } from '../../../core/models';
import {
  circumstanceLabel,
  circumstanceOptionsFor,
  isCircumstanceValidFor
} from '../../fnol/config/circumstances';
import {
  futureDateValidator,
  dateOrderValidator
} from '../../../shared/validators/date.validators';
import { LossInfoDiscardModalComponent } from './loss-info-discard-modal.component';
import {
  IMPACT_LABELS,
  LABEL_TO_FIELD_KEY,
  LossInfoDiffField,
  computeLossInfoDiffs
} from './loss-info-diff';

type SpecifyOtherKey = 'specifyOtherCauseOfLoss';
type PerFieldKey =
  | 'causeOfLoss'
  | 'circumstance'
  | 'typeOfDamage'
  | 'dateGroup'
  | 'lossDescription'
  | 'lossLocation';

@Component({
  selector: 'app-edit-loss-information',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxTimefieldModule,
    NxDatefieldModule,
    NxDropdownModule,
    NxMultiSelectComponent,
    NxBadgeModule,
    NxMessageModule,
    NxModalModule,
    NxSpinnerModule,
    LocationPickerComponent,
    PageHeaderComponent,
    StatusChipComponent
  ],
  templateUrl: './edit-loss-information.component.html',
  styleUrl: './edit-loss-information.component.scss'
})
export class EditLossInformationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lossInfoSvc = inject(MockLossInformationService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly overviewSvc = inject(MockClaimOverviewService);
  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly live = inject(LiveAnnouncer);

  readonly claimId = signal<string>('');
  readonly clientName = signal<string>('');
  readonly claimStatus = signal<string>('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly original = signal<LossInformation | null>(null);
  readonly policyNumber = signal<string | null>(null);
  readonly maxDesc = 500;
  submitAttempted = false;

  // ── Own FormGroup — isolated from FNOL wizard ────────────────────────
  readonly form = new FormGroup({
    dateOfLoss: new FormGroup(
      {
        dateOfOccurrence: new FormControl<string | null>(null, [
          Validators.required,
          futureDateValidator
        ]),
        timeOfOccurrence: new FormControl<string | null>(null, [Validators.required]),
        dateOfNotification: new FormControl<string | null>(null, [
          Validators.required,
          futureDateValidator
        ]),
        timeOfNotification: new FormControl<string | null>(null, [Validators.required])
      },
      { validators: dateOrderValidator }
    ),
    lossLocation: new FormControl<LocationPickerOutput>({ locations: [] }),
    causeOfLoss: new FormControl<string[]>([], []),
    // Added 2026-08-31 (Marlene feedback) — was FNOL-only until now; the
    // LossInformation model/service already carried typeOfDamage end to end,
    // this form just never exposed it.
    typeOfDamage: new FormControl<string[]>([], []),
    // Free-text qualifier for the "Other Event" cause. The validator is
    // attached at runtime by syncSpecifyOther() because "required" depends on
    // whether causeOfLoss currently includes that value. typeOfDamage has no
    // counterpart by design — see OTHER_CAUSE_KEY in core/models/lookup.model.ts.
    specifyOtherCauseOfLoss: new FormControl<string>(''),
    // BMPCC-18160 — single incident circumstance, options narrowed by
    // causeOfLoss. Not required: the peril is often confirmed long before
    // anyone can say what actually happened.
    circumstance: new FormControl<string | null>(null),
    lossDescription: new FormControl('', [Validators.required, Validators.maxLength(500)])
  });

  get dateOfLoss() {
    return this.form.get('dateOfLoss') as FormGroup;
  }
  get lossLocation() {
    return this.form.get('lossLocation') as FormControl<LocationPickerOutput>;
  }

  // ── Lookups ──────────────────────────────────────────────────────────
  readonly causeOfLossOptions$ = this.lookupSvc.getCauseOfLoss();
  readonly causeOfLossOptions = toSignal(this.causeOfLossOptions$, { initialValue: [] });
  readonly typeOfDamageOptions$ = this.lookupSvc.getTypeOfDamage();
  readonly typeOfDamageOptions = toSignal(this.typeOfDamageOptions$, { initialValue: [] });

  get selectedCauses(): string[] {
    return (this.form.get('causeOfLoss')?.value as string[]) ?? [];
  }
  get selectedDamages(): string[] {
    return (this.form.get('typeOfDamage')?.value as string[]) ?? [];
  }

  // `specify` folds the typed qualifier into the "Other" entry — reading back
  // "Other" alone would hide the only part of that selection that says anything.
  private causeLabelsFor(keys: string[], specify = ''): string {
    if (!keys.length) return '';
    const opts = this.causeOfLossOptions();
    return keys
      .map(k =>
        this.qualify(opts.find(o => o.value === k)?.label ?? k, k === OTHER_CAUSE_KEY, specify)
      )
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

  get typeOfDamageDisplay(): string {
    return this.damageLabelsFor(this.selectedDamages);
  }

  get showSpecifyOtherCause(): boolean {
    return this.selectedCauses.includes(OTHER_CAUSE_KEY);
  }

  onCauseOfLossChange(selected: string[]): void {
    this.syncSpecifyOther('specifyOtherCauseOfLoss', selected.includes(OTHER_CAUSE_KEY));
    // BMPCC-18160 — re-pointing the peril can leave a circumstance the new
    // peril doesn't offer. Clearing it here is what makes the change show up in
    // the ledger, so the user sees what their edit knocked out.
    const circ = this.form.get('circumstance');
    if (circ && !isCircumstanceValidFor(circ.value as string | null, selected)) circ.setValue(null);
  }

  // ── Incident circumstance (BMPCC-18160) ───────────────────────────────
  get circumstanceOptions(): LookupOption[] {
    return circumstanceOptionsFor(this.selectedCauses);
  }
  get circumstanceDisplay(): string {
    return circumstanceLabel(this.form.get('circumstance')?.value as string | null);
  }
  get originalCircumstanceDisplay(): string {
    return circumstanceLabel(this.original()?.circumstance) || 'Not provided';
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
  isEditing(key: string): boolean {
    return this.editingField() === key;
  }
  startEdit(key: string): void {
    this.editingField.set(key);
  }
  closeEdit(): void {
    this.editingField.set(null);
  }

  readonly isDirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), {
    initialValue: false
  });

  // Reactive diff list — fieldChanged()'s "Changed" badge/"was:" line, each
  // onSaveField()'s per-field diff, and confirmLeaveIfDirty()'s pending-edit
  // check all read from this one signal instead of separate ad-hoc checks.
  private readonly formSnapshot = toSignal(this.form.valueChanges.pipe(startWith(null)), {
    initialValue: null
  });
  readonly pendingChanges = computed<LossInfoDiffField[]>(() => {
    this.formSnapshot(); // form.valueChanges fires for every control in this.form
    return this.computeDiffs();
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

    firstValueFrom(this.overviewSvc.getOverview(id)).then(claim => {
      this.policyNumber.set(claim?.policyNumber ?? null);
      this.clientName.set(claim?.client ?? '');
      this.claimStatus.set(claim?.status ?? '');
    });
  }

  private prefillForm(li: LossInformation): void {
    this.dateOfLoss.patchValue({
      dateOfOccurrence: li.dateOfLoss?.dateOfOccurrence ?? null,
      timeOfOccurrence: li.dateOfLoss?.timeOfOccurrence ?? null,
      dateOfNotification: li.dateOfLoss?.dateOfNotification ?? null,
      timeOfNotification: li.dateOfLoss?.timeOfNotification ?? null
    });
    this.form.patchValue({
      causeOfLoss: li.causeOfLoss ?? [],
      typeOfDamage: li.typeOfDamage ?? [],
      specifyOtherCauseOfLoss: li.specifyOtherCauseOfLoss ?? '',
      circumstance: li.circumstance ?? null,
      lossDescription: li.lossDescription ?? '',
      lossLocation: (li.lossLocation as unknown as LocationPickerOutput) ?? { locations: [] }
    });
    // Reconcile the runtime validator against what was just loaded — no
    // selectionChange fires on a patchValue, so this is the only chance.
    this.syncSpecifyOther('specifyOtherCauseOfLoss', this.showSpecifyOtherCause);
    // Cause of loss used to auto-open when empty while every other field
    // (Incident circumstance, Type of damage — also frequently empty on the
    // same claim) stayed closed behind its Update/Add link. One field
    // behaving differently from its siblings for no reason a user can see
    // read as broken, not deliberate. All fields now start closed uniformly.
    this.editingField.set(null);
    this.form.markAsPristine();
  }

  // ── "was" display, per field group ────────────────────────────────────
  get originalCauseOfLossDisplay(): string {
    const o = this.original();
    return (
      this.causeLabelsFor(o?.causeOfLoss ?? [], o?.specifyOtherCauseOfLoss ?? '') || 'Not provided'
    );
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
    const occ = this.formatDateTime(
      o?.dateOfLoss?.dateOfOccurrence,
      o?.dateOfLoss?.timeOfOccurrence
    );
    const notif = this.formatDateTime(
      o?.dateOfLoss?.dateOfNotification,
      o?.dateOfLoss?.timeOfNotification
    );
    return `Occurred: ${occ} · Reported: ${notif}`;
  }

  get originalLossLocationDisplay(): string {
    const loc = (this.original()?.lossLocation as { locations?: { displayName?: string }[] } | null)
      ?.locations?.[0]?.displayName;
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
      this.form.getRawValue() as unknown as LossInformationFormValue
    );
  }

  // ── Per-field save/cancel ──────────────────────────────────────────────
  // Every field commits on its own as soon as the user is done with it — no
  // bottom "Save all" round trip, no confirm modal (the field's own input is
  // the last look: there's nothing hidden or batched to lose). Cause of loss
  // also reverts Incident circumstance on cancel, since editing it can
  // silently invalidate circumstance's current value (onCauseOfLossChange).
  private fieldPayload(key: PerFieldKey): Partial<LossInformationFormValue> {
    switch (key) {
      case 'causeOfLoss':
        return {
          causeOfLoss: this.form.get('causeOfLoss')!.value as string[],
          specifyOtherCauseOfLoss: this.form.get('specifyOtherCauseOfLoss')!.value as string
        };
      case 'circumstance':
        return { circumstance: this.form.get('circumstance')!.value as string | null };
      case 'typeOfDamage':
        return { typeOfDamage: this.form.get('typeOfDamage')!.value as string[] };
      case 'dateGroup':
        return { dateOfLoss: this.dateOfLoss.getRawValue() };
      case 'lossDescription':
        return { lossDescription: this.form.get('lossDescription')!.value as string };
      case 'lossLocation':
        return {
          lossLocation: this.lossLocation.value as unknown as LossInformationFormValue['lossLocation']
        };
    }
  }

  private fieldControls(key: PerFieldKey): AbstractControl[] {
    switch (key) {
      case 'causeOfLoss':
        return [this.form.get('causeOfLoss')!, this.form.get('specifyOtherCauseOfLoss')!];
      case 'circumstance':
        return [this.form.get('circumstance')!];
      case 'typeOfDamage':
        return [this.form.get('typeOfDamage')!];
      case 'dateGroup':
        return [this.dateOfLoss];
      case 'lossDescription':
        return [this.form.get('lossDescription')!];
      case 'lossLocation':
        return [this.lossLocation];
    }
  }

  async onSaveField(key: PerFieldKey): Promise<void> {
    this.submitAttempted = true;
    const controls = this.fieldControls(key);
    if (controls.some(c => c.invalid)) {
      controls.forEach(c => c.markAllAsTouched());
      return;
    }

    const diffs = this.computeDiffs().filter(d => LABEL_TO_FIELD_KEY[d.label] === key);
    if (!diffs.length) {
      this.submitAttempted = false;
      this.editingField.set(null);
      return;
    }

    this.saving.set(true);
    const partial = this.fieldPayload(key);
    try {
      await firstValueFrom(
        this.lossInfoSvc.save(partial as LossInformationFormValue, this.claimId())
      );

      const activities: ClaimActivity[] = diffs.map((d, i) => ({
        id: `act-edit-${Date.now()}-${i}`,
        claimId: this.claimId(),
        user: 'Current User',
        timestamp: new Date().toISOString(),
        objectType: 'Loss Information',
        attribute: d.label,
        valueOld: d.original || null,
        valueNew: d.updated || null
      }));
      if (activities.length) this.overviewSvc.appendActivities?.(this.claimId(), activities);

      // Claim Overview shows its own dateOfLoss/proximateLossCause/
      // incidentCircumstance/description fields, separate from the
      // LossInformation record this form edits — without this an edit here
      // saves correctly but Overview keeps showing the pre-edit value.
      await this.syncOverviewFromLossInfo(
        this.form.getRawValue() as unknown as LossInformationFormValue,
        diffs
      );

      // pendingChanges() compares live form values against this snapshot,
      // independently of form.dirty — without updating it post-save, the
      // canDeactivate guard would still see the just-saved value as
      // "pending" and fire the leave-confirmation on this save's own
      // sections-impact navigate() below.
      this.original.set({ ...(this.original() as LossInformation), ...partial } as LossInformation);
      controls.forEach(c => c.markAsPristine());
      this.submitAttempted = false;
      this.editingField.set(null);
      this.toast.success(`${diffs[0].label} updated`, this.claimId());
      this.live.announce(`${diffs[0].label} updated successfully.`, 'polite');

      // ClaimSection/SectionEntity still carry no structured link back to a
      // cause-of-loss or location key — there is no reliable way to tell
      // which existing sections a change actually affects, even after the
      // FNOL/claim-file model work (ClaimSection.damageType has no
      // relationship to causeOfLoss anywhere). Treat cause-of-loss, type of
      // damages, or location changes as sections-impacting and send the user
      // to review manually, per the Miro flow ("triggers changes to existing
      // sections" → notify + redirect). Signed off 2026-08-18 — see
      // CONVERSIONS.md. Fires per-field now instead of once at the end of a
      // batch — the accepted tradeoff of no field going through a bottom
      // "Save all" button anymore.
      const impacted = diffs.filter(d => IMPACT_LABELS.includes(d.label));
      if (impacted.length) {
        this.router.navigate(['/claims', this.claimId(), 'sections'], {
          queryParams: {
            changedFields: impacted.map(d => d.label),
            changedOld: impacted.map(d => d.original),
            changedNew: impacted.map(d => d.updated)
          }
        });
      }
    } catch {
      this.toast.error('Failed to save', 'Please try again. Your changes have been kept.');
    } finally {
      this.saving.set(false);
    }
  }

  onCancelField(key: PerFieldKey): void {
    const o = this.original();
    switch (key) {
      case 'causeOfLoss': {
        const causeKeys = o?.causeOfLoss ?? [];
        this.form.get('causeOfLoss')!.setValue(causeKeys);
        this.form.get('specifyOtherCauseOfLoss')!.setValue(o?.specifyOtherCauseOfLoss ?? '');
        this.syncSpecifyOther('specifyOtherCauseOfLoss', causeKeys.includes(OTHER_CAUSE_KEY));
        this.form.get('circumstance')!.setValue(o?.circumstance ?? null);
        this.form.get('circumstance')!.markAsPristine();
        break;
      }
      case 'circumstance':
        this.form.get('circumstance')!.setValue(o?.circumstance ?? null);
        break;
      case 'typeOfDamage':
        this.form.get('typeOfDamage')!.setValue(o?.typeOfDamage ?? []);
        break;
      case 'dateGroup':
        this.dateOfLoss.patchValue({
          dateOfOccurrence: o?.dateOfLoss?.dateOfOccurrence ?? null,
          timeOfOccurrence: o?.dateOfLoss?.timeOfOccurrence ?? null,
          dateOfNotification: o?.dateOfLoss?.dateOfNotification ?? null,
          timeOfNotification: o?.dateOfLoss?.timeOfNotification ?? null
        });
        break;
      case 'lossDescription':
        this.form.get('lossDescription')!.setValue(o?.lossDescription ?? '');
        break;
      case 'lossLocation':
        this.lossLocation.setValue(
          (o?.lossLocation as unknown as LocationPickerOutput) ?? { locations: [] }
        );
        break;
    }
    this.fieldControls(key).forEach(c => c.markAsPristine());
    this.submitAttempted = false;
    this.editingField.set(null);
  }

  private async syncOverviewFromLossInfo(
    formValue: LossInformationFormValue,
    diffs: LossInfoDiffField[]
  ): Promise<void> {
    const patch: {
      dateOfLoss?: string;
      proximateLossCause?: string;
      causeOfLoss?: string[];
      incidentCircumstance?: string;
      description?: string;
    } = {};

    // Claim Overview's "Claim description" field reads ClaimOverview.description,
    // not LossInformation.lossDescription directly — without this, editing the
    // description here saved correctly (activity log shows the diff) but Overview
    // silently kept showing the pre-edit text forever. Same gap as the
    // incidentCircumstance fix below, just missed for this field.
    if (diffs.some(d => d.label === 'Loss description')) {
      patch.description = formValue.lossDescription ?? undefined;
    }

    if (
      diffs.some(d => d.label === 'Date of occurrence') &&
      formValue.dateOfLoss?.dateOfOccurrence
    ) {
      patch.dateOfLoss = formValue.dateOfLoss.dateOfOccurrence;
    }
    if (diffs.some(d => d.label === 'Cause of loss')) {
      // proximateLossCause stays a single "headline" value (the first cause)
      // for compact summaries — causeOfLoss carries every cause so the
      // Reference Panel and any other detail view can show the full list
      // instead of silently only ever showing the first one.
      const causeKeys = formValue.causeOfLoss ?? [];
      const causeLabels = causeKeys.map(
        k => this.causeOfLossOptions().find(o => o.value === k)?.label ?? k
      );
      patch.proximateLossCause = causeLabels[0] ?? '–';
      patch.causeOfLoss = causeLabels;
    }
    // BMPCC-18160 — Claim Overview and the Section detail panel read
    // incidentCircumstance off the claim, so a change here has to land there
    // too or the overview keeps showing the pre-investigation circumstance.
    // The key is stored, not the label — see ASSUMPTION [CIRC-4].
    if (diffs.some(d => d.label === 'Incident circumstance')) {
      patch.incidentCircumstance = formValue.circumstance ?? undefined;
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
    if (!canLeave) return;
    // Reset to original BEFORE navigating — the route's canDeactivate guard
    // re-runs confirmLeaveIfDirty() on this very navigate() call, and without
    // this it still saw the untouched form as dirty and opened the same
    // discard modal a second time right after the user had just confirmed it.
    const o = this.original();
    if (o) this.prefillForm(o);
    this.router.navigate(['/claims', this.claimId(), 'overview']);
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
