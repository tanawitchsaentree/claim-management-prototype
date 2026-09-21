import { Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  ReactiveFormsModule,
  FormArray,
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { BehaviorSubject, combineLatest, firstValueFrom, Observable, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  finalize,
  map,
  shareReplay,
  startWith,
  switchMap,
  tap
} from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxTimefieldModule } from '@allianz/ng-aquila/timefield';
import { NxDatefieldModule } from '@allianz/ng-aquila/datefield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxMultiSelectComponent } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { NxAccordionModule } from '@allianz/ng-aquila/accordion';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LookupOption, LocationPickerOutput, OTHER_CAUSE_KEY } from '../../../../core/models';
import {
  DuplicateCheckService,
  DuplicateClaim
} from '../../../../core/services/duplicate-check.service';
import { getCauseSchema, DEFAULT_CAUSE_SCHEMA, CauseSchema } from '../../config/cause-schemas';
import { circumstanceOptionsFor, isCircumstanceValidFor } from '../../config/circumstances';
import { LocationPickerComponent } from '../../../../shared/components/location-picker/location-picker.component';
import { ScenarioStageService } from '../../../../core/scenario/scenario-stage.service';
import { FnolLossInfoStage } from '../../../../core/scenario/scenario-stage.model';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { getErrorMessage } from '../../../../core/validators/error-messages';

interface FormError {
  fieldId: string;
  message: string;
}

type SpecifyOtherKey = 'specifyOtherCauseOfLoss';

interface LossInfoVM {
  causeOfLoss: LookupOption[];
  typeOfDamage: LookupOption[];
  countries: LookupOption[];
  duplicates: DuplicateClaim[];
  showDuplicateBanner: boolean;
}

@Component({
  selector: 'app-step-loss-information',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxIconModule,
    NxCheckboxModule,
    NxTimefieldModule,
    NxDatefieldModule,
    NxDropdownModule,
    NxMultiSelectComponent,
    NxRadioModule,
    NxMessageModule,
    NxModalModule,
    NxSpinnerModule,
    NxTableModule,
    NxLinkModule,
    LocationPickerComponent,
    StatusChipComponent,
    RouterLink,
    WizardFooterComponent,
    NxAccordionModule
  ],
  templateUrl: './step-loss-information.component.html',
  styleUrl: './step-loss-information.component.scss'
})
export class StepLossInformationComponent implements OnInit, OnDestroy, FnolLossInfoStage {
  readonly page = 'fnol-loss-info' as const;

  private fnolState = inject(FnolStateService);
  private lookupSvc = inject(MockLookupService);
  private duplicateCheckSvc = inject(DuplicateCheckService);
  private router = inject(Router);
  private modalService = inject(NxDialogService);
  private stageSvc = inject(ScenarioStageService);
  private readonly live = inject(LiveAnnouncer);
  private deregisterStage: (() => void) | null = null;

  @ViewChild('duplicatesModalTpl') duplicatesModalTpl!: TemplateRef<void>;
  @ViewChild(LocationPickerComponent) locationPicker?: LocationPickerComponent;

  readonly form = this.fnolState.fnolForm.get('lossInformation') as FormGroup;
  readonly dateOfLoss = this.fnolState.getDateOfLossGroup();
  readonly lossLocation = this.fnolState.getLossLocationControl();
  readonly eventsArray = this.fnolState.getLossEventsArray();
  readonly policyNumber = this.fnolState.selectedPolicy?.policyNumber ?? null;
  readonly cbiLocation = this.form.get('cbiLocation') as FormGroup;
  readonly cbiCaseTypeOptions = this.lookupSvc.getCbiCaseTypesSync();

  readonly maxDesc = 500;
  submitAttempted = false;

  formErrors: FormError[] = [];

  private readonly bannerDismissed$ = new BehaviorSubject<boolean>(false);
  readonly duplicateCheckLoading$ = new BehaviorSubject<boolean>(false);

  vm$!: Observable<LossInfoVM>;

  // ── Field label map for error summary ─────────────────────────────
  private readonly fieldLabels: Record<string, string> = {
    'dateOfOccurrence': 'Date of occurrence',
    'timeOfOccurrence': 'Time of occurrence',
    'dateOfNotification': 'Date of notification',
    'timeOfNotification': 'Time of notification',
    'dateOfLoss': 'Date of loss (group)',
    'causeOfLoss': 'Cause of loss',
    'typeOfDamage': 'Type of damage',
    'specifyOtherCauseOfLoss': 'Specify other cause of loss',
    'cbiApplicable': 'Contingent business interruption',
    'cbiCaseType': 'CBI case type',
    'cbiThirdPartyName': 'Third-party name',
    'cbiLocationCountry': 'Originating loss location: country',
    'cbiLocationCity': 'Originating loss location: city',
    'cbiLocationZip': 'Originating loss location: ZIP'
  };

  ngOnInit(): void {
    // Register the stage immediately so postLand hooks can find this component.
    this.deregisterStage = this.stageSvc.register(this);

    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient) {
      this.router.navigate(['/fnol/search']);
      return;
    }

    // The form is root-provided and may arrive prefilled (skeleton convert,
    // edit-loss-information) — in that case no selectionChange ever fired, so
    // the specify-other validators have to be reconciled once on entry.
    this.syncSpecifyOther('specifyOtherCauseOfLoss', this.showSpecifyOtherCause);
    this.syncCbi();

    const policyNumber = this.fnolState.selectedPolicy?.policyNumber;

    // TODO [FNOL-DUP-3]: Confirm with product which permission roles should see the
    // duplicate warning banner (currently shown to all users in the FNOL wizard).
    //
    // DESIGN DECISION [FNOL-DUP-4]: Trigger uses cause+date, not date-only (AC2 literal).
    // Rationale: cause-aware narrowing avoids false positives; banner copy communicates
    // "same policy, date, and cause of loss" so the user sees what was matched.
    // PENDING: Product sign-off on cause+date vs strict AC2 date-only trigger.
    const duplicates$: Observable<DuplicateClaim[]> = policyNumber
      ? combineLatest([
          this.form
            .get('causeOfLoss')!
            .valueChanges.pipe(startWith(this.form.get('causeOfLoss')!.value as string[])),
          this.dateOfLoss
            .get('dateOfOccurrence')!
            .valueChanges.pipe(
              startWith(this.dateOfLoss.get('dateOfOccurrence')!.value as string | null)
            )
        ])
          .pipe(
            debounceTime(1000),
            tap(() => {
              this.bannerDismissed$.next(false);
              this.duplicateCheckLoading$.next(true);
            }),
            switchMap(([causes, date]) =>
              date
                ? this.duplicateCheckSvc
                    .checkDuplicates(policyNumber, date, causes?.length ? causes : undefined)
                    .pipe(
                      map(r => r.duplicates),
                      catchError(() => of([] as DuplicateClaim[])),
                      finalize(() => this.duplicateCheckLoading$.next(false))
                    )
                : of([] as DuplicateClaim[]).pipe(
                    finalize(() => this.duplicateCheckLoading$.next(false))
                  )
            )
          )
          .pipe(shareReplay(1))
      : of([] as DuplicateClaim[]);

    this.vm$ = combineLatest({
      causeOfLoss: this.lookupSvc.getCauseOfLoss(),
      typeOfDamage: this.lookupSvc.getTypeOfDamage(),
      countries: this.lookupSvc.getCountries(),
      duplicates: duplicates$,
      showDuplicateBanner: combineLatest([duplicates$, this.bannerDismissed$]).pipe(
        map(([dups, dismissed]) => ({ show: dups.length > 0 && !dismissed, count: dups.length })),
        tap(({ show, count }) => {
          if (show) {
            this.live.announce(
              `${count} existing claim${count === 1 ? ' was' : 's were'} found with the same policy, date, and cause of loss`,
              'polite'
            );
          }
        }),
        map(({ show }) => show)
      )
    });
  }

  ngOnDestroy(): void {
    this.deregisterStage?.();
  }

  // ── Stage hooks ─────────────────────────────────────────────────────
  async prefillDuplicate(date: string, causes: string[]): Promise<void> {
    // Set values; ng-aquila controls subscribe to valueChanges so the existing
    // duplicates$ pipeline fires through normal channels.
    this.bannerDismissed$.next(false);
    this.form.get('causeOfLoss')?.setValue(causes);
    this.dateOfLoss.get('dateOfOccurrence')?.setValue(date);
    this.form.get('causeOfLoss')?.markAsDirty();
    this.dateOfLoss.get('dateOfOccurrence')?.markAsDirty();
  }

  async openShowAllDuplicates(date: string, causes: string[]): Promise<void> {
    await this.prefillDuplicate(date, causes);
    // 1s debounce + ~300ms mock delay; 1500ms is comfortable.
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (!this.policyNumber) return;
    const result = await firstValueFrom(
      this.duplicateCheckSvc.checkDuplicates(this.policyNumber, date, causes)
    );
    if (result.duplicates.length > 0) {
      this.openDuplicatesModal(result.duplicates);
    }
  }

  async openLocationPicker(): Promise<void> {
    // Wait until the LocationPicker child is mounted and its vm$ resolves.
    let lp = this.locationPicker;
    let tries = 0;
    while (!lp && tries < 20) {
      await new Promise(resolve => setTimeout(resolve, 50));
      lp = this.locationPicker;
      tries++;
    }
    if (!lp) return;
    if (lp.locations.length > 0) return;
    interface LpVm {
      policyLocations: import('../../../../core/models').PolicyLocation[];
    }
    const vm$ = (lp as unknown as { vm$?: Observable<LpVm> }).vm$;
    if (!vm$) return;
    const vm = await firstValueFrom(vm$);
    await lp.addLocation(vm.policyLocations);
  }

  // CWB scenario stage hooks — kept as no-ops because the picker no longer
  // exposes a CWB UI mode (CWB modal still lives at shared/ if other flows
  // need it). injectCwbAsLoss below remains the canonical scripted entry.
  async selectCwbMode(): Promise<void> {
    /* no-op: CWB radio removed from picker */
  }
  async openCwbModal(): Promise<void> {
    /* no-op: CWB radio removed from picker */
  }

  async prefillCwbCountry(_country: string): Promise<void> {
    /* CWB modal owns the form; left as a no-op for v3 */
  }
  async runCwbSearch(): Promise<void> {
    /* requires modal-side stage; deferred */
  }
  async selectCwbRow(_cwbReference: string): Promise<void> {
    /* deferred */
  }

  async injectCwbAsLoss(cwbReference: string): Promise<void> {
    const lp = this.locationPicker;
    if (!lp) return;
    const dataMod = await import('../../../../core/mock/data/cwb-locations.json');
    const seedArr = ((dataMod as { default?: unknown }).default ??
      dataMod) as import('../../../../core/models').CwbLocation[];
    const picked = seedArr.find(c => c.cwbReference === cwbReference);
    if (!picked) return;
    const item: import('../../../../core/models').LocationItem = {
      id: 'cwb-stage-' + picked.cwbReference,
      source: 'cwb',
      displayName: picked.locationName,
      addressLine1: picked.streetAndNumber,
      postalCode: picked.postalCode,
      city: picked.city,
      country: picked.country,
      propertyId: picked.cwbReference,
      latitude: picked.latitude,
      longitude: picked.longitude,
      cwbReference: picked.cwbReference,
      locationRuleNumber: picked.locationRuleNumber
    };
    lp.locations = [...lp.locations, item];
    lp.locationChange.emit({ locations: lp.locations });
  }

  // ── Error display helper ────────────────────────────────────────────

  showError(field: AbstractControl): boolean {
    return field.invalid && (field.touched || this.submitAttempted);
  }

  showGroupError(group: AbstractControl, errorKey: string): boolean {
    return !!group.errors?.[errorKey] && (group.touched || this.submitAttempted);
  }

  // ── Global error summary ───────────────────────────────────────────

  private collectErrors(): FormError[] {
    const errors: FormError[] = [];

    const dateGroup = this.dateOfLoss;
    const dateFields = [
      'dateOfOccurrence',
      'timeOfOccurrence',
      'dateOfNotification',
      'timeOfNotification'
    ];
    dateFields.forEach(key => {
      const ctrl = dateGroup.get(key);
      if (ctrl?.errors) {
        const msg = getErrorMessage(ctrl.errors);
        if (msg) errors.push({ fieldId: key, message: `${this.fieldLabels[key]}: ${msg}` });
      }
    });

    if (dateGroup.errors?.['dateOrder']) {
      errors.push({
        fieldId: 'dateOfLoss',
        message: 'Notification date must be on or after occurrence date'
      });
    }

    if (this.selectedCauses.length === 0) {
      errors.push({ fieldId: 'causeOfLoss', message: 'Cause of loss: select at least one option' });
    }
    if (this.selectedDamages.length === 0) {
      errors.push({
        fieldId: 'typeOfDamage',
        message: 'Type of damage: select at least one option'
      });
    }

    // Only reachable while the field is on screen — syncSpecifyOther() strips
    // the validator the moment "Other" is deselected.
    const specifyCtrl = this.form.get('specifyOtherCauseOfLoss');
    if (specifyCtrl?.errors) {
      const msg = getErrorMessage(specifyCtrl.errors);
      if (msg)
        errors.push({
          fieldId: 'specifyOtherCauseOfLoss',
          message: `${this.fieldLabels['specifyOtherCauseOfLoss']}: ${msg}`
        });
    }

    for (let i = 0; i < this.eventsArray.length; i++) {
      const grp = this.eventGroup(i);
      if ((grp.get('damages')?.value as string[])?.length === 0) {
        const label = this.getCauseLabel(grp.get('eventKey')!.value as string);
        errors.push({ fieldId: `damages-${i}`, message: `${label}: select at least one damage` });
      }
    }

    // Only reachable while shown — syncCbi() strips validators the moment
    // Business Interruption is deselected or the question is answered No.
    if (this.showCbiQuestion && !this.cbiApplicable) {
      errors.push({
        fieldId: 'cbiApplicable',
        message: `${this.fieldLabels['cbiApplicable']}: answer required`
      });
    }
    if (this.showCbiDetails) {
      if (!this.selectedCbiCaseType) {
        errors.push({ fieldId: 'cbiCaseType', message: `${this.fieldLabels['cbiCaseType']}: required` });
      }
      if (
        this.showCbiThirdPartyName &&
        this.cbiThirdPartyRequired &&
        !this.form.get('cbiThirdPartyName')?.value
      ) {
        errors.push({
          fieldId: 'cbiThirdPartyName',
          message: `${this.fieldLabels['cbiThirdPartyName']}: required`
        });
      }
      (['country', 'city', 'zip'] as const).forEach(key => {
        if (!this.cbiLocation.get(key)?.value) {
          errors.push({
            fieldId: `cbiLocation${key.charAt(0).toUpperCase()}${key.slice(1)}`,
            message: `${this.fieldLabels[`cbiLocation${key.charAt(0).toUpperCase()}${key.slice(1)}`]}: required`
          });
        }
      });
    }

    return errors;
  }

  private markAllTouched(group: AbstractControl): void {
    group.markAsTouched();
    if (group instanceof FormGroup) {
      Object.values(group.controls).forEach(c => this.markAllTouched(c));
    } else if (group instanceof FormArray) {
      group.controls.forEach(c => this.markAllTouched(c));
    }
  }

  private scrollToErrorSummary(): void {
    setTimeout(() => {
      document
        .querySelector('.form-errors-summary')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  scrollToField(fieldId: string): void {
    // Re-open the accordion first — clicking an error-summary link for a
    // field inside a collapsed "Originating loss location" must not land
    // on an invisible target.
    if (fieldId.startsWith('cbiLocation')) {
      this.cbiLocationPanelExpanded = true;
    }
    setTimeout(() => {
      const el = document.querySelector(`[data-field="${fieldId}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el.querySelector('input, textarea, nx-multi-select') as HTMLElement | null;
      input?.focus();
    });
  }

  // ── Duplicate banner ────────────────────────────────────────────────

  dismissDuplicateBanner(): void {
    this.bannerDismissed$.next(true);
  }

  modalDuplicates: DuplicateClaim[] = [];

  openDuplicatesModal(all: DuplicateClaim[]): void {
    this.modalDuplicates = all;
    this.modalService.open(this.duplicatesModalTpl, {
      showCloseIcon: true,
      width: '960px',
      maxWidth: '92vw',
      ariaLabelledBy: 'dup-modal-title'
    });
  }

  // ── Computed flags ──────────────────────────────────────────────────

  get selectedCauses(): string[] {
    return (this.form.get('causeOfLoss')?.value as string[]) ?? [];
  }

  get selectedDamages(): string[] {
    return (this.form.get('typeOfDamage')?.value as string[]) ?? [];
  }

  get descLength(): number {
    return (this.form.get('lossDescription')?.value as string)?.length ?? 0;
  }

  onLocationChange(output: LocationPickerOutput): void {
    this.lossLocation.setValue(output);
  }

  // ── Schema helpers ─────────────────────────────────────────────────

  getCauseLabel(causeKey: string): string {
    return getCauseSchema(causeKey)?.causeLabel ?? causeKey;
  }

  getCausedByOptions(causeKey: string): LookupOption[] | null {
    const opts = getCauseSchema(causeKey)?.causedByOptions;
    return opts && opts.length > 0 ? opts : null;
  }

  trackByEventKey(_index: number, ctrl: AbstractControl): string {
    return (ctrl as FormGroup).get('eventKey')!.value as string;
  }

  // ── Multi-select handlers ───────────────────────────────────────────

  onCauseOfLossChange(selected: string[]): void {
    this._syncEventsArray(selected);
    this.syncSpecifyOther('specifyOtherCauseOfLoss', selected.includes(OTHER_CAUSE_KEY));
    this.syncCircumstance(selected);
  }

  // ── Incident circumstance (BMPCC-18160) ─────────────────────────────
  // Options are derived, not stored, so the list can never drift from the
  // cause selection. A pick the new cause no longer offers is cleared rather
  // than left in place invisibly — see circumstances.ts for the peril mapping
  // and its three recorded assumptions.

  get circumstanceOptions(): LookupOption[] {
    return circumstanceOptionsFor(this.selectedCauses);
  }

  get selectedCircumstance(): string | null {
    return (this.form.get('circumstance')?.value as string | null) ?? null;
  }

  private syncCircumstance(selected: string[]): void {
    const ctrl = this.form.get('circumstance');
    if (!ctrl) return;
    if (!isCircumstanceValidFor(ctrl.value as string | null, selected)) ctrl.setValue(null);
  }

  // "Required" here depends on a sibling control's value, so the validator is
  // attached at runtime rather than declared in FnolStateService. Clearing the
  // value on hide matters: a hidden control holding a stale value would keep
  // failing validation with nothing on screen to fix.
  private syncSpecifyOther(key: SpecifyOtherKey, needed: boolean): void {
    const ctrl = this.form.get(key);
    if (!ctrl) return;
    if (needed) {
      ctrl.setValidators([Validators.required, Validators.maxLength(100)]);
    } else {
      ctrl.clearValidators();
      ctrl.setValue('');
    }
    ctrl.updateValueAndValidity();
  }

  get showSpecifyOtherCause(): boolean {
    return this.selectedCauses.includes(OTHER_CAUSE_KEY);
  }

  onTypeOfDamageChange(_selected: string[]): void {
    this.syncCbi();
  }

  // ── CBI: contingent business interruption (BMPCC-18353) ─────────────
  // Trigger question sits next to Type of damage, not inside a per-cause
  // event block — CBI is a refinement of the BI damage type itself, not of
  // any one cause of loss (a fire, a flood, an earthquake can each trigger
  // BI at a third party). Mirrors syncSpecifyOther()'s shape: validators are
  // added/cleared here, not declared statically, because "required" depends
  // on sibling control values (typeOfDamage, cbiApplicable, cbiCaseType).

  // Held back on purpose (2026-09-17) — the whole CBI capture (trigger
  // question through case type/location/third-party), same reason as
  // entity-detail-panel's showCbiLocation: BMPCC-17927 is still "Draft A v2",
  // Open Points #1 and #4 aren't signed off with Sarah/UW. This gates
  // showCbiQuestion itself, so showCbiDetails/syncCbi()'s validators all
  // cascade off — nothing partially shows. Flip to true only when told.
  readonly cbiFeatureEnabled = true; // LOCAL ONLY for tonight's boss walkthrough — not deployed

  get showCbiQuestion(): boolean {
    // ASSUMPTION [CBI-FNOL-2]: functional design gates this on the
    // Conclusion Engine finding ≥1 possible CBI case for the policy
    // (covers/extendedBy). No live AiP/Conclusion Engine exists in this
    // prototype, so the question is shown whenever Business Interruption is
    // selected — the full 12-option list is offered rather than a
    // policy-filtered subset. Recorded, not blocking.
    //
    // BMPCC-17927 ticket scope, checked 2026-09-21: "shown when Business
    // Interruption is checked and Property Damage is not" — CBI is BI caused
    // by damage at a third party's premises, not the insured's own, so BI +
    // Property Damage together isn't a CBI scenario. Missing the second half
    // of that condition let the question appear on exactly that combination.
    return (
      this.cbiFeatureEnabled &&
      this.selectedDamages.includes('business-interruption') &&
      !this.selectedDamages.includes('material-damage')
    );
  }

  get cbiApplicable(): 'yes' | 'no' | null {
    return (this.form.get('cbiApplicable')?.value as 'yes' | 'no' | null) ?? null;
  }

  get showCbiDetails(): boolean {
    return this.showCbiQuestion && this.cbiApplicable === 'yes';
  }

  // Accordion, open by default (user's call — collapsing all 7 fields,
  // including the 3 required ones, trades a real risk: a handler who
  // collapses it and clicks Next would see the error summary point at a
  // field they can't see). Mitigated, not avoided: onNext() below force-
  // reopens this if any Originating Loss Location field is still invalid,
  // so the collapsed state can never hide a blocking error.
  cbiLocationPanelExpanded = true;

  get selectedCbiCaseType(): string | null {
    return (this.form.get('cbiCaseType')?.value as string | null) ?? null;
  }

  // 'supplier-*' / 'customer-*' case types are the only ones with an actual
  // named counterparty — Denial of Access / Loss of Attraction / Port
  // Blockage / Service Interruption have no third party to name.
  get showCbiThirdPartyName(): boolean {
    const key = this.selectedCbiCaseType;
    return !!key && (key.startsWith('supplier-') || key.startsWith('customer-'));
  }

  // ASSUMPTION [CBI-FNOL-3]: the functional design's field table literally
  // says the name is "Required for: Supplier Named/Unnamed, Customer
  // Named/Unnamed" — read at face value that would force a name on an
  // "Unnamed" party, which contradicts what "Unnamed" means. Only the
  // "-named" case types require it here; "-unnamed" still offers the field
  // (a handler may know a loose description even without a formal name)
  // but doesn't block on it.
  get cbiThirdPartyRequired(): boolean {
    return !!this.selectedCbiCaseType?.endsWith('-named');
  }

  get cbiThirdPartyLabel(): string {
    const base = this.selectedCbiCaseType?.startsWith('customer-')
      ? 'Customer name'
      : 'Supplier name';
    return this.cbiThirdPartyRequired ? base : `${base} (optional)`;
  }

  onCbiApplicableChange(): void {
    this.syncCbi();
  }

  syncCbi(): void {
    const applicableCtrl = this.form.get('cbiApplicable');
    if (applicableCtrl) {
      if (this.showCbiQuestion) {
        applicableCtrl.setValidators([Validators.required]);
      } else {
        applicableCtrl.clearValidators();
        applicableCtrl.setValue(null);
      }
      applicableCtrl.updateValueAndValidity({ emitEvent: false });
    }

    const caseTypeCtrl = this.form.get('cbiCaseType');
    const thirdPartyCtrl = this.form.get('cbiThirdPartyName');
    const showDetails = this.showCbiQuestion && this.cbiApplicable === 'yes';

    if (caseTypeCtrl) {
      if (showDetails) {
        caseTypeCtrl.setValidators([Validators.required]);
      } else {
        caseTypeCtrl.clearValidators();
        caseTypeCtrl.setValue(null);
      }
      caseTypeCtrl.updateValueAndValidity({ emitEvent: false });
    }

    if (thirdPartyCtrl) {
      if (showDetails && this.showCbiThirdPartyName && this.cbiThirdPartyRequired) {
        thirdPartyCtrl.setValidators([Validators.required, Validators.maxLength(100)]);
      } else if (showDetails && this.showCbiThirdPartyName) {
        thirdPartyCtrl.setValidators([Validators.maxLength(100)]);
      } else {
        thirdPartyCtrl.clearValidators();
        thirdPartyCtrl.setValue('');
      }
      thirdPartyCtrl.updateValueAndValidity({ emitEvent: false });
    }

    const locationRequired = ['country', 'city', 'zip'];
    for (const key of locationRequired) {
      const ctrl = this.cbiLocation.get(key);
      if (!ctrl) continue;
      if (showDetails) {
        ctrl.setValidators([Validators.required]);
      } else {
        ctrl.clearValidators();
        ctrl.setValue(key === 'country' ? null : '');
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
    if (!showDetails) {
      ['street', 'houseNumber', 'landRecordNumber', 'state'].forEach(key =>
        this.cbiLocation.get(key)?.setValue('')
      );
    }
  }

  // ── Events array ────────────────────────────────────────────────────

  private _syncEventsArray(selected: string[]): void {
    for (let i = this.eventsArray.length - 1; i >= 0; i--) {
      if (!selected.includes(this.eventsArray.at(i).get('eventKey')!.value as string)) {
        this.eventsArray.removeAt(i);
      }
    }
    selected.forEach(key => {
      const exists = (this.eventsArray.controls as FormGroup[]).some(
        g => g.get('eventKey')!.value === key
      );
      if (!exists) this.eventsArray.push(this._createEventGroup(key));
    });
    const sorted = selected
      .map(
        key =>
          (this.eventsArray.controls as FormGroup[]).find(g => g.get('eventKey')!.value === key)!
      )
      .filter(Boolean);
    while (this.eventsArray.length) this.eventsArray.removeAt(0);
    sorted.forEach(g => this.eventsArray.push(g));
  }

  private _createEventGroup(causeKey: string): FormGroup {
    const schema: CauseSchema = getCauseSchema(causeKey) ?? {
      causeKey,
      causeLabel: causeKey,
      ...DEFAULT_CAUSE_SCHEMA
    };

    const controls: Record<string, AbstractControl> = {
      eventKey: new FormControl(causeKey),
      damages: new FormControl<string[]>([], [Validators.required])
    };

    if (schema.causedByOptions && schema.causedByOptions.length > 0) {
      controls['causedBy'] = new FormControl<string[]>([]);
    }

    return new FormGroup(controls);
  }

  // ── Event helpers ───────────────────────────────────────────────────

  eventGroup(i: number): FormGroup {
    return this.eventsArray.at(i) as FormGroup;
  }

  // ── Damage checkbox helpers ─────────────────────────────────────────

  availableDamages(vm: LossInfoVM): LookupOption[] {
    const sel = this.selectedDamages;
    return sel.length ? vm.typeOfDamage.filter(o => sel.includes(o.value)) : vm.typeOfDamage;
  }

  isDamageChecked(eventIdx: number, val: string): boolean {
    return ((this.eventGroup(eventIdx).get('damages')!.value as string[]) ?? []).includes(val);
  }

  onDamageToggle(eventIdx: number, val: string, checked: boolean): void {
    const ctrl = this.eventGroup(eventIdx).get('damages')!;
    const list = [...((ctrl.value as string[]) ?? [])];
    if (checked) {
      if (!list.includes(val)) list.push(val);
    } else {
      list.splice(list.indexOf(val), 1);
    }
    ctrl.setValue(list);
  }

  // ── Caused-by checkbox helpers ──────────────────────────────────────

  isCausedByChecked(eventIdx: number, val: string): boolean {
    return ((this.eventGroup(eventIdx).get('causedBy')?.value as string[]) ?? []).includes(val);
  }

  onCausedByToggle(eventIdx: number, val: string, checked: boolean): void {
    const ctrl = this.eventGroup(eventIdx).get('causedBy');
    if (!ctrl) return;
    const list = [...((ctrl.value as string[]) ?? [])];
    if (checked) {
      if (!list.includes(val)) list.push(val);
    } else {
      list.splice(list.indexOf(val), 1);
    }
    ctrl.setValue(list);
  }

  // ── Navigation ───────────────────────────────────────────────────────

  onBack(): void {
    this.router.navigate(
      this.fnolState.path === 'orphan' ? ['/fnol/skeleton-create'] : ['/fnol/search']
    );
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  onNext(): void {
    this.submitAttempted = true;
    this.markAllTouched(this.form);

    const causeValid = this.selectedCauses.length > 0;
    const damageValid = this.selectedDamages.length > 0;
    const eventsValid = this.eventsArray.controls.every(
      c => ((c.get('damages')?.value as string[]) ?? []).length > 0
    );

    this.formErrors = this.collectErrors();

    // A collapsed accordion must never hide a blocking error — if the
    // handler closed "Originating loss location" before filling the
    // required fields, force it back open so the error summary's links
    // actually point at something visible.
    if (this.showCbiDetails && this.cbiLocation.invalid) {
      this.cbiLocationPanelExpanded = true;
    }

    if (!causeValid || !damageValid || !eventsValid || this.form.invalid) {
      this.scrollToErrorSummary();
      return;
    }

    this.fnolState.markStepComplete('loss-information');
    this.router.navigate(['/fnol/entities-damages']);
  }
}
