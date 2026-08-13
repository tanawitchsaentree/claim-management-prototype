import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { combineLatest, firstValueFrom } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { toSignal } from '@angular/core/rxjs-interop';
import { MockLossInformationService } from '../../../core/mock/services/mock-loss-information.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockClaimOverviewService } from '../../../core/mock/services/mock-claim-overview.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { LossInformation, LossInformationFormValue } from '../../../core/models/loss-information.model';
import { ClaimActivity } from '../../../core/models/claim-overview.model';
import { LocationPickerOutput } from '../../../core/models';
import { getCauseSchema, DEFAULT_CAUSE_SCHEMA } from '../../fnol/config/cause-schemas';
import { FnolStateService } from '../../fnol/services/fnol-state.service';
import {
  LossInfoConfirmModalComponent,
  LossInfoConfirmModalData,
  LossInfoDiffField,
} from './loss-info-confirm-modal.component';
import { LossInfoDiscardModalComponent } from './loss-info-discard-modal.component';

// Claim description lives on ClaimOverview, not on LossInformation — it is
// edited here (this is the only edit screen) but saved through a different
// service and logged against a different objectType. The label is the key
// that routes it, so it is a const rather than a repeated literal.
const CLAIM_DESC_LABEL = 'Claim description';

@Component({
  selector: 'app-edit-loss-information',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    NxButtonModule, NxIconModule, NxFormfieldModule, NxInputModule,
    NxCheckboxModule, NxTimefieldModule, NxDatefieldModule,
    NxDropdownModule, NxMultiSelectComponent, NxRadioModule,
    NxMessageModule, NxModalModule, NxSpinnerModule,
    NxAccordionModule,
    LocationPickerComponent,
    PageHeaderComponent,
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
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly toast        = inject(ToastService);
  private readonly fnolState    = inject(FnolStateService);

  readonly claimId      = signal<string>('');
  readonly loading      = signal(true);
  readonly saving       = signal(false);
  readonly saveSuccess  = signal(false);
  readonly original     = signal<LossInformation | null>(null);
  readonly policyNumber = signal<string | null>(null);
  readonly originalClaimDescription = signal<string>('');
  readonly maxDesc   = 500;
  submitAttempted    = false;

  // ── Own FormGroup — isolated from FNOL wizard ────────────────────────
  readonly form = new FormGroup({
    // Claim-level, not loss-level. Deliberately not required: an existing
    // claim can arrive with an empty description (skeleton claims synthesize
    // it from lossDescription), and that must not block a loss-info save.
    claimDescription: new FormControl('', [Validators.maxLength(500)]),
    dateOfLoss: new FormGroup({
      dateOfOccurrence:   new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
      timeOfOccurrence:   new FormControl<string | null>(null, [Validators.required]),
      dateOfNotification: new FormControl<string | null>(null, [Validators.required, FnolStateService.futureDateValidator]),
      timeOfNotification: new FormControl<string | null>(null, [Validators.required]),
    }, { validators: FnolStateService.dateOrderValidator }),
    lossLocation:    new FormControl<LocationPickerOutput>({ locations: [] }),
    causeOfLoss:     new FormControl<string[]>([], []),
    typeOfDamage:    new FormControl<string[]>([], []),
    lossDescription: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    causeDetails: new FormGroup({
      fire: new FormGroup({
        fireOrigin:                  new FormControl(''),
        fireDepartmentCalled:        new FormControl<boolean | null>(null),
        fireDepartmentReportNumber:  new FormControl(''),
      }),
      waterDamage: new FormGroup({
        waterSource:     new FormControl<string | null>(null),
        affectedAreaSqm: new FormControl<number | null>(null),
      }),
      theft: new FormGroup({
        policeReportNumber:   new FormControl(''),
        estimatedValueStolen: new FormControl<number | null>(null),
        dateReportedToPolice: new FormControl<string | null>(null),
      }),
    }),
    events: new FormArray([]),
  });

  get dateOfLoss()   { return this.form.get('dateOfLoss') as FormGroup; }
  get causeDetails() { return this.form.get('causeDetails') as FormGroup; }
  get eventsArray()  { return this.form.get('events') as FormArray; }
  get claimDescription() { return this.form.get('claimDescription') as FormControl<string | null>; }
  get lossLocation() { return this.form.get('lossLocation') as FormControl<LocationPickerOutput>; }

  // ── Lookups ──────────────────────────────────────────────────────────
  readonly causeOfLossOptions$  = this.lookupSvc.getCauseOfLoss();
  readonly typeOfDamageOptions$ = this.lookupSvc.getTypeOfDamage();
  readonly waterSources$        = this.lookupSvc.getWaterSources();

  readonly causeOfLossOptions  = toSignal(this.causeOfLossOptions$,  { initialValue: [] });
  readonly typeOfDamageOptions = toSignal(this.typeOfDamageOptions$, { initialValue: [] });
  readonly waterSources        = toSignal(this.waterSources$,        { initialValue: [] });

  // ── Computed cause/damage selected values ────────────────────────────
  get selectedCauses(): string[]  { return (this.form.get('causeOfLoss')?.value  as string[]) ?? []; }
  get selectedDamages(): string[] { return (this.form.get('typeOfDamage')?.value as string[]) ?? []; }
  readonly showFireDetails  = toSignal(this.form.get('causeOfLoss')!.valueChanges.pipe(startWith([] as string[]), map(v => (v as string[]).includes('fire'))), { initialValue: false });
  readonly showWaterDetails = toSignal(this.form.get('causeOfLoss')!.valueChanges.pipe(startWith([] as string[]), map(v => (v as string[]).includes('water-damage'))), { initialValue: false });
  readonly showTheftDetails = toSignal(this.form.get('causeOfLoss')!.valueChanges.pipe(startWith([] as string[]), map(v => (v as string[]).includes('theft'))),        { initialValue: false });

  readonly isDirty = toSignal(this.form.valueChanges.pipe(map(() => this.form.dirty)), { initialValue: false });

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
      const desc = claim?.description ?? '';
      this.originalClaimDescription.set(desc);
      this.claimDescription.setValue(desc);
      this.claimDescription.markAsPristine();
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
      lossDescription: li.lossDescription ?? '',
      lossLocation:    (li.lossLocation as unknown as LocationPickerOutput) ?? { locations: [] },
    });
    if (li.causeDetails) {
      this.causeDetails.patchValue(li.causeDetails as object);
    }
    // Rebuild events
    this.eventsArray.clear();
    (li.events ?? []).forEach(ev => {
      this.eventsArray.push(new FormGroup({
        eventKey: new FormControl(ev.eventKey),
        damages:  new FormControl<string[]>(ev.damages ?? [], [Validators.required]),
        ...(ev.causedBy ? { causedBy: new FormControl<string[]>(ev.causedBy) } : {}),
      }));
    });
    this.form.markAsPristine();
  }

  // ── Cause selection → update events array ────────────────────────────
  onCauseOfLossChange(causes: string[]): void {
    this.eventsArray.clear();
    causes.forEach(causeKey => {
      const schema = getCauseSchema(causeKey) ?? DEFAULT_CAUSE_SCHEMA;
      const controls: Record<string, FormControl> = {
        eventKey: new FormControl(causeKey),
        damages:  new FormControl<string[]>(this.selectedDamages.length ? this.selectedDamages : [], [Validators.required]),
      };
      if (schema?.causedByOptions?.length) {
        controls['causedBy'] = new FormControl<string[]>([]);
      }
      this.eventsArray.push(new FormGroup(controls));
    });
  }

  // ── Diff computation ─────────────────────────────────────────────────
  private computeDiffs(): LossInfoDiffField[] {
    const diffs: LossInfoDiffField[] = [];

    const addIf = (label: string, o: unknown, n: unknown) => {
      const os = o == null ? '' : String(o);
      const ns = n == null ? '' : String(n);
      if (os !== ns) diffs.push({ label, original: os, updated: ns });
    };

    // Claim-level field, diffed against the ClaimOverview value it came from.
    // Computed before the LossInformation guard below — a claim can have no
    // loss-information record yet, and a description edit must still register.
    addIf(CLAIM_DESC_LABEL, this.originalClaimDescription(), this.claimDescription.value);

    const orig = this.original();
    if (!orig) return diffs;
    const cur = this.form.getRawValue() as unknown as LossInformationFormValue;

    // Dates & times
    addIf('Date of occurrence',    orig.dateOfLoss?.dateOfOccurrence,   cur.dateOfLoss?.dateOfOccurrence);
    addIf('Time of occurrence',    orig.dateOfLoss?.timeOfOccurrence,   cur.dateOfLoss?.timeOfOccurrence);
    addIf('Date of notification',  orig.dateOfLoss?.dateOfNotification, cur.dateOfLoss?.dateOfNotification);
    addIf('Time of notification',  orig.dateOfLoss?.timeOfNotification, cur.dateOfLoss?.timeOfNotification);

    // General
    addIf('Cause of loss',   (orig.causeOfLoss ?? []).join(', '),  (cur.causeOfLoss ?? []).join(', '));
    addIf('Loss description', orig.lossDescription, cur.lossDescription);

    // Loss location (compare by displayName of first location as proxy)
    const origLoc = (orig.lossLocation as { locations?: { displayName?: string }[] } | null)?.locations?.[0]?.displayName ?? '';
    const curLoc  = (cur.lossLocation  as { locations?: { displayName?: string }[] } | null)?.locations?.[0]?.displayName ?? '';
    addIf('Loss location', origLoc, curLoc);

    // Fire cause details
    const oCd = orig.causeDetails as unknown as LossInformation['causeDetails'];
    const nCd = cur.causeDetails  as unknown as LossInformation['causeDetails'];
    addIf('Fire origin',                oCd?.fire?.fireOrigin,                nCd?.fire?.fireOrigin);
    addIf('Fire department called',     oCd?.fire?.fireDepartmentCalled,      nCd?.fire?.fireDepartmentCalled);
    addIf('Fire dept. report number',   oCd?.fire?.fireDepartmentReportNumber, nCd?.fire?.fireDepartmentReportNumber);

    // Water damage cause details
    addIf('Water source',        oCd?.waterDamage?.waterSource,     nCd?.waterDamage?.waterSource);
    addIf('Affected area (m²)',  oCd?.waterDamage?.affectedAreaSqm, nCd?.waterDamage?.affectedAreaSqm);

    // Theft cause details
    addIf('Police report number',    oCd?.theft?.policeReportNumber,    nCd?.theft?.policeReportNumber);
    addIf('Estimated value stolen',  oCd?.theft?.estimatedValueStolen,  nCd?.theft?.estimatedValueStolen);
    addIf('Date reported to police', oCd?.theft?.dateReportedToPolice,  nCd?.theft?.dateReportedToPolice);

    // Events damages (compare per-event damage selection as joined string)
    const origEvents = orig.events ?? [];
    const curEvents  = (cur as unknown as { events: typeof origEvents }).events ?? [];
    origEvents.forEach((oe, i) => {
      const ce = curEvents[i];
      if (!ce) return;
      addIf(
        `${oe.eventKey} damages`,
        (oe.damages ?? []).join(', '),
        (ce.damages ?? []).join(', ')
      );
    });

    return diffs;
  }

  // ── Save flow ─────────────────────────────────────────────────────────
  async onSaveChanges(): Promise<void> {
    this.submitAttempted = true;
    if (this.form.invalid) return;

    const diffs = this.computeDiffs();
    const data: LossInfoConfirmModalData = { claimId: this.claimId(), diffs };
    const ref = this.dialogSvc.open(LossInfoConfirmModalComponent, { data, width: '600px', maxWidth: '92vw' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result !== 'confirmed') return;

    this.saveSuccess.set(false);
    this.saving.set(true);
    // claimDescription belongs to ClaimOverview — keep it out of the payload
    // or MockLossInformationService.save spreads it onto the stored record.
    const { claimDescription: _claimDesc, ...lossInfoRaw } = this.form.getRawValue();
    const formValue = lossInfoRaw as unknown as LossInformationFormValue;
    try {
      await firstValueFrom(this.lossInfoSvc.save(formValue, this.claimId()));

      // Write activity log entries for changed fields
      const activities: ClaimActivity[] = diffs.map((d, i) => ({
        id:         `act-edit-${Date.now()}-${i}`,
        claimId:    this.claimId(),
        user:       'Current User',
        timestamp:  new Date().toISOString(),
        objectType: d.label === CLAIM_DESC_LABEL ? 'Claim' : 'Loss Information',
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

      this.form.markAsPristine();
      this.saveSuccess.set(true);

      // Damage types feed Sections (per entity), but nothing in this app maps a
      // damage-type string back to the section entities that were built from it —
      // so we cannot safely auto-update/delete sections. Send the user to Sections
      // to review manually instead of guessing.
      const damageChanged = diffs.some(d => d.label.endsWith(' damages'));
      if (damageChanged) {
        this.toast.warning(
          'Damage types changed',
          'Existing sections may no longer match — review them on the Sections page.',
        );
        this.router.navigate(['/claims', this.claimId(), 'sections']);
      } else {
        this.toast.success('Loss information updated', `${activities.length} field(s) changed on ${this.claimId()}`);
        this.router.navigate(['/claims', this.claimId(), 'overview']);
      }
    } catch {
      this.toast.error('Failed to save', 'Please try again. Your changes have been kept.');
      // Form stays dirty — user remains on edit screen to retry.
    } finally {
      this.saving.set(false);
    }
  }

  private async syncOverviewFromLossInfo(formValue: LossInformationFormValue, diffs: LossInfoDiffField[]): Promise<void> {
    const patch: { dateOfLoss?: string; proximateLossCause?: string; description?: string } = {};

    if (diffs.some(d => d.label === 'Date of occurrence') && formValue.dateOfLoss?.dateOfOccurrence) {
      patch.dateOfLoss = formValue.dateOfLoss.dateOfOccurrence;
    }
    if (diffs.some(d => d.label === 'Cause of loss')) {
      const firstCauseKey = formValue.causeOfLoss?.[0];
      const label = this.causeOfLossOptions().find(o => o.value === firstCauseKey)?.label;
      patch.proximateLossCause = label ?? firstCauseKey ?? '–';
    }
    // Claim description has no loss-information home — the overview record is
    // where it lives, and the overview page reads it straight back.
    if (diffs.some(d => d.label === CLAIM_DESC_LABEL)) {
      patch.description = this.claimDescription.value ?? '';
    }

    if (Object.keys(patch).length) {
      await firstValueFrom(this.overviewSvc.updateGeneralInfo(this.claimId(), patch));
    }
  }

  // ── Discard flow ──────────────────────────────────────────────────────
  async onDiscard(): Promise<void> {
    if (!this.form.dirty) {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
      return;
    }
    const ref = this.dialogSvc.open(LossInfoDiscardModalComponent, { width: '440px' });
    const result = await firstValueFrom(ref.afterClosed());
    if (result === 'discard') {
      this.router.navigate(['/claims', this.claimId(), 'overview']);
    }
  }

  getEventCauseOptions(eventKey: string) {
    const schema = getCauseSchema(eventKey) ?? DEFAULT_CAUSE_SCHEMA;
    return schema?.causedByOptions ?? [];
  }

  getEventDamageOptions(_eventKey: string) {
    return this.typeOfDamageOptions();
  }

  isEventCauseSelected(eventGroup: FormGroup, value: string): boolean {
    const v = eventGroup.get('causedBy')?.value as string[] ?? [];
    return v.includes(value);
  }

  toggleEventCause(eventGroup: FormGroup, value: string): void {
    const ctrl = eventGroup.get('causedBy');
    if (!ctrl) return;
    const cur = (ctrl.value as string[]) ?? [];
    ctrl.markAsDirty();
    ctrl.setValue(cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]);
  }

  isEventDamageSelected(eventGroup: FormGroup, value: string): boolean {
    const v = eventGroup.get('damages')?.value as string[] ?? [];
    return v.includes(value);
  }

  toggleEventDamage(eventGroup: FormGroup, value: string): void {
    const ctrl = eventGroup.get('damages');
    if (!ctrl) return;
    const cur = (ctrl.value as string[]) ?? [];
    ctrl.markAsDirty();
    ctrl.setValue(cur.includes(value) ? cur.filter(x => x !== value) : [...cur, value]);
  }

  getEventGroup(i: number): FormGroup { return this.eventsArray.at(i) as FormGroup; }
  getEventKey(i: number): string { return this.eventsArray.at(i).get('eventKey')?.value as string ?? ''; }
}
