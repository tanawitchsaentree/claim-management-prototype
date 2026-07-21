import { Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, ReactiveFormsModule, FormArray, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, firstValueFrom, Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
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
import { FnolStateService } from '../../services/fnol-state.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LookupOption, LocationPickerOutput } from '../../../../core/models';
import { DuplicateCheckService, DuplicateClaim } from '../../../../core/services/duplicate-check.service';
import { getCauseSchema, DEFAULT_CAUSE_SCHEMA, CauseSchema } from '../../config/cause-schemas';
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

interface LossInfoVM {
  causeOfLoss: LookupOption[];
  typeOfDamage: LookupOption[];
  waterSources: LookupOption[];
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
    NxAccordionModule,
  ],
  templateUrl: './step-loss-information.component.html',
  styleUrl: './step-loss-information.component.scss',
})
export class StepLossInformationComponent implements OnInit, OnDestroy, FnolLossInfoStage {
  readonly page = 'fnol-loss-info' as const;

  private fnolState         = inject(FnolStateService);
  private lookupSvc         = inject(MockLookupService);
  private duplicateCheckSvc = inject(DuplicateCheckService);
  private router            = inject(Router);
  private modalService      = inject(NxDialogService);
  private stageSvc          = inject(ScenarioStageService);
  private deregisterStage: (() => void) | null = null;

  @ViewChild('duplicatesModalTpl') duplicatesModalTpl!: TemplateRef<void>;
  @ViewChild(LocationPickerComponent) locationPicker?: LocationPickerComponent;

  readonly form            = this.fnolState.fnolForm.get('lossInformation') as FormGroup;
  readonly dateOfLoss      = this.fnolState.getDateOfLossGroup();
  readonly lossLocation    = this.fnolState.getLossLocationControl();
  readonly causeDetails    = this.fnolState.getCauseDetailsGroup();
  readonly eventsArray     = this.fnolState.getLossEventsArray();
  readonly policyNumber    = this.fnolState.selectedPolicy?.policyNumber ?? null;

  readonly maxDesc = 500;
  submitAttempted = false;

  formErrors: FormError[] = [];

  private readonly bannerDismissed$ = new BehaviorSubject<boolean>(false);
  readonly duplicateCheckLoading$ = new BehaviorSubject<boolean>(false);

  vm$!: Observable<LossInfoVM>;

  // ── Field label map for error summary ─────────────────────────────
  private readonly fieldLabels: Record<string, string> = {
    'dateOfOccurrence':   'Date of occurrence',
    'timeOfOccurrence':   'Time of occurrence',
    'dateOfNotification': 'Date of notification',
    'timeOfNotification': 'Time of notification',
    'dateOfLoss':         'Date of loss (group)',
    'causeOfLoss':        'Cause of loss',
    'typeOfDamage':       'Type of damage',
  };

  ngOnInit(): void {
    // Register the stage immediately so postLand hooks can find this component.
    this.deregisterStage = this.stageSvc.register(this);

    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient) {
      this.router.navigate(['/fnol/search']);
      return;
    }

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
          this.form.get('causeOfLoss')!.valueChanges.pipe(startWith(this.form.get('causeOfLoss')!.value as string[])),
          this.dateOfLoss.get('dateOfOccurrence')!.valueChanges.pipe(startWith(this.dateOfLoss.get('dateOfOccurrence')!.value as string | null)),
        ]).pipe(
          debounceTime(1000),
          tap(() => { this.bannerDismissed$.next(false); this.duplicateCheckLoading$.next(true); }),
          switchMap(([causes, date]) =>
            date
              ? this.duplicateCheckSvc.checkDuplicates(policyNumber, date, causes?.length ? causes : undefined).pipe(
                  map(r => r.duplicates),
                  catchError(() => of([] as DuplicateClaim[])),
                  finalize(() => this.duplicateCheckLoading$.next(false))
                )
              : of([] as DuplicateClaim[]).pipe(finalize(() => this.duplicateCheckLoading$.next(false)))
          )
        ).pipe(shareReplay(1))
      : of([] as DuplicateClaim[]);

    this.vm$ = combineLatest({
      causeOfLoss:  this.lookupSvc.getCauseOfLoss(),
      typeOfDamage: this.lookupSvc.getTypeOfDamage(),
      waterSources: this.lookupSvc.getWaterSources(),
      duplicates:         duplicates$,
      showDuplicateBanner: combineLatest([duplicates$, this.bannerDismissed$]).pipe(
        map(([dups, dismissed]) => dups.length > 0 && !dismissed)
      ),
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
      this.duplicateCheckSvc.checkDuplicates(this.policyNumber, date, causes),
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
    type LpVm = { policyLocations: import('../../../../core/models').PolicyLocation[] };
    const vm$ = (lp as unknown as { vm$?: Observable<LpVm> }).vm$;
    if (!vm$) return;
    const vm = await firstValueFrom(vm$);
    await lp.addLocation(vm.policyLocations);
  }

  // CWB scenario stage hooks — kept as no-ops because the picker no longer
  // exposes a CWB UI mode (CWB modal still lives at shared/ if other flows
  // need it). injectCwbAsLoss below remains the canonical scripted entry.
  async selectCwbMode(): Promise<void> { /* no-op: CWB radio removed from picker */ }
  async openCwbModal(): Promise<void>  { /* no-op: CWB radio removed from picker */ }

  async prefillCwbCountry(_country: string): Promise<void> { /* CWB modal owns the form; left as a no-op for v3 */ }
  async runCwbSearch(): Promise<void> { /* requires modal-side stage; deferred */ }
  async selectCwbRow(_cwbReference: string): Promise<void> { /* deferred */ }

  async injectCwbAsLoss(cwbReference: string): Promise<void> {
    const lp = this.locationPicker;
    if (!lp) return;
    const dataMod = await import('../../../../core/mock/data/cwb-locations.json');
    const seedArr = ((dataMod as { default?: unknown }).default ?? dataMod) as import('../../../../core/models').CwbLocation[];
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
      locationRuleNumber: picked.locationRuleNumber,
    };
    lp.locations = [...lp.locations, item];
    lp.locationChange.emit({ locations: lp.locations });
  }

  // ── Error display helper ────────────────────────────────────────────

  showError(field: AbstractControl): boolean {
    return field.invalid && (field.touched || this.submitAttempted);
  }

  showGroupError(group: AbstractControl, errorKey: string): boolean {
    return !!(group.errors?.[errorKey]) && (group.touched || this.submitAttempted);
  }

  // ── Global error summary ───────────────────────────────────────────

  private collectErrors(): FormError[] {
    const errors: FormError[] = [];

    const dateGroup = this.dateOfLoss;
    const dateFields = ['dateOfOccurrence', 'timeOfOccurrence', 'dateOfNotification', 'timeOfNotification'];
    dateFields.forEach(key => {
      const ctrl = dateGroup.get(key);
      if (ctrl?.errors) {
        const msg = getErrorMessage(ctrl.errors);
        if (msg) errors.push({ fieldId: key, message: `${this.fieldLabels[key]}: ${msg}` });
      }
    });

    if (dateGroup.errors?.['dateOrder']) {
      errors.push({ fieldId: 'dateOfLoss', message: 'Notification date must be on or after occurrence date' });
    }

    if (this.selectedCauses.length === 0) {
      errors.push({ fieldId: 'causeOfLoss', message: 'Cause of loss: select at least one option' });
    }
    if (this.selectedDamages.length === 0) {
      errors.push({ fieldId: 'typeOfDamage', message: 'Type of damage: select at least one option' });
    }

    for (let i = 0; i < this.eventsArray.length; i++) {
      const grp = this.eventGroup(i);
      if ((grp.get('damages')?.value as string[])?.length === 0) {
        const label = this.getCauseLabel(grp.get('eventKey')!.value as string);
        errors.push({ fieldId: `damages-${i}`, message: `${label}: select at least one damage` });
      }
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
      document.querySelector('.form-errors-summary')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  scrollToField(fieldId: string): void {
    const el = document.querySelector(`[data-field="${fieldId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = el.querySelector('input, textarea, nx-multi-select') as HTMLElement | null;
    input?.focus();
  }

  // ── Duplicate banner ────────────────────────────────────────────────

  dismissDuplicateBanner(): void {
    this.bannerDismissed$.next(true);
  }

  modalDuplicates: DuplicateClaim[] = [];

  openDuplicatesModal(all: DuplicateClaim[]): void {
    this.modalDuplicates = all;
    this.modalService.open(this.duplicatesModalTpl, { showCloseIcon: true, width: '960px', maxWidth: '92vw', ariaLabelledBy: 'dup-modal-title' });
  }

  // ── Computed flags ──────────────────────────────────────────────────

  get selectedCauses(): string[] {
    return (this.form.get('causeOfLoss')?.value as string[]) ?? [];
  }

  get selectedDamages(): string[] {
    return (this.form.get('typeOfDamage')?.value as string[]) ?? [];
  }

  get showFireSection(): boolean  { return this.selectedCauses.includes('fire'); }
  get showWaterSection(): boolean { return this.selectedCauses.includes('water-damage'); }
  get showTheftSection(): boolean { return this.selectedCauses.includes('theft'); }
  get showCauseSection(): boolean {
    return this.showFireSection || this.showWaterSection || this.showTheftSection;
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
  }

  onTypeOfDamageChange(_selected: string[]): void {
    // formControlName handles value sync; no extra action needed
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
    const sorted = selected.map(key =>
      (this.eventsArray.controls as FormGroup[]).find(g => g.get('eventKey')!.value === key)!
    ).filter(Boolean);
    while (this.eventsArray.length) this.eventsArray.removeAt(0);
    sorted.forEach(g => this.eventsArray.push(g));
  }

  private _createEventGroup(causeKey: string): FormGroup {
    const schema: CauseSchema = getCauseSchema(causeKey) ?? {
      causeKey,
      causeLabel: causeKey,
      ...DEFAULT_CAUSE_SCHEMA,
    };

    const controls: Record<string, AbstractControl> = {
      eventKey: new FormControl(causeKey),
      damages:  new FormControl<string[]>([], [Validators.required]),
    };

    if (schema.causedByOptions && schema.causedByOptions.length > 0) {
      controls['causedBy'] = new FormControl<string[]>([]);
    }

    return new FormGroup(controls);
  }

  // ── Event helpers ───────────────────────────────────────────────────

  eventGroup(i: number): FormGroup { return this.eventsArray.at(i) as FormGroup; }

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
    checked ? (list.includes(val) ? null : list.push(val)) : list.splice(list.indexOf(val), 1);
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
    checked ? (list.includes(val) ? null : list.push(val)) : list.splice(list.indexOf(val), 1);
    ctrl.setValue(list);
  }

  // ── Fire details helpers ─────────────────────────────────────────────

  get fireDeptCalled(): boolean | null {
    return this.causeDetails.get('fire.fireDepartmentCalled')?.value as boolean | null;
  }

  setFireDeptCalled(val: boolean): void {
    this.causeDetails.get('fire.fireDepartmentCalled')?.setValue(val);
  }

  // ── Navigation ───────────────────────────────────────────────────────

  onBack(): void {
    this.router.navigate(
      this.fnolState.path === 'orphan' ? ['/fnol/skeleton-create'] : ['/fnol/search']
    );
  }

  onCancel(): void { this.router.navigate(['/dashboard']); }

  onNext(): void {
    this.submitAttempted = true;
    this.markAllTouched(this.form);

    const causeValid  = this.selectedCauses.length > 0;
    const damageValid = this.selectedDamages.length > 0;
    const eventsValid = this.eventsArray.controls.every(
      c => ((c.get('damages')?.value as string[]) ?? []).length > 0
    );

    this.formErrors = this.collectErrors();

    if (!causeValid || !damageValid || !eventsValid || this.form.invalid) {
      this.scrollToErrorSummary();
      return;
    }

    this.fnolState.markStepComplete('loss-information');
    this.router.navigate(['/fnol/entities-damages']);
  }
}
