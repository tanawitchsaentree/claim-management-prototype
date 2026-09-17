import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import {
  Observable,
  ReplaySubject,
  switchMap,
  catchError,
  of,
  map,
  startWith,
  shareReplay
} from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { MockCwbService } from '../../../core/mock/services/mock-cwb.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import {
  PolicyLocation,
  CwbLocation,
  CwbSearchFilters,
  CwbManualAddress,
  AddLocationModalResult,
  LookupOption
} from '../../../core/models';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ManualAddressSectionComponent } from './manual-address-section/manual-address-section.component';

export interface AddLocationModalData {
  policyNumber: string;
  locationRuleNumber?: string;
  policyLocations: PolicyLocation[];
}

interface CwbSearchState {
  results: CwbLocation[];
  loading: boolean;
  error: boolean;
  searched: boolean;
}

@Component({
  selector: 'app-add-location-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxTabsModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    NxRadioModule,
    NxTableModule,
    NxCheckboxModule,
    NxSpinnerModule,
    NxMessageModule,
    EmptyStateComponent,
    ManualAddressSectionComponent
  ],
  templateUrl: './add-location-modal.component.html',
  styleUrl: './add-location-modal.component.scss'
})
export class AddLocationModalComponent implements OnInit {
  readonly data = inject<AddLocationModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AddLocationModalComponent, AddLocationModalResult | null>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly cwbSvc = inject(MockCwbService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly activeTab = signal<0 | 1>(0);

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[])
  );

  // ── Policy tab ───────────────────────────────────────────────────────────
  readonly policyForm = new FormGroup({
    name: new FormControl(''),
    id: new FormControl(''),
    city: new FormControl('')
  });
  readonly policyResults = signal<PolicyLocation[]>([]);
  readonly selectedPolicyId = signal<string | null>(null);

  // ── CWB tab ──────────────────────────────────────────────────────────────
  readonly cwbForm: FormGroup = this.fb.group({
    policyNumber: [{ value: '', disabled: true }, Validators.required],
    locationRuleNumber: [{ value: '', disabled: true }, Validators.required],
    country: ['', Validators.required],
    city: [''],
    postalCode: [''],
    streetAndNumber: ['']
  });
  private readonly cwbSearchTrigger$ = new ReplaySubject<CwbSearchFilters>(1);
  readonly cwbState$: Observable<CwbSearchState> = this.cwbSearchTrigger$.pipe(
    switchMap(filters =>
      this.cwbSvc.search(filters).pipe(
        map((results): CwbSearchState => ({ results, loading: false, error: false, searched: true })),
        catchError(
          (): Observable<CwbSearchState> =>
            of({ results: [], loading: false, error: true, searched: true })
        ),
        startWith({ results: [], loading: true, error: false, searched: false } as CwbSearchState)
      )
    ),
    startWith({ results: [], loading: false, error: false, searched: false } as CwbSearchState),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly selectedCwbRefs = signal<Set<string>>(new Set());

  // ── Manual entry (shared across both tabs) ──────────────────────────────
  readonly manualForm: FormGroup = this.fb.group({
    country: ['', Validators.required],
    city: ['', Validators.required],
    postalCode: ['', Validators.required],
    streetAndNumber: ['', Validators.required],
    addressLine2: [''],
    state: [''],
    notes: ['', Validators.maxLength(300)]
  });
  manualSubmitted = false;
  readonly manualEntries = signal<CwbManualAddress[]>([]);

  readonly hasAnySelection = computed(
    () =>
      this.selectedPolicyId() !== null ||
      this.selectedCwbRefs().size > 0 ||
      this.manualEntries().length > 0
  );
  readonly addCount = computed(
    () =>
      (this.selectedPolicyId() ? 1 : 0) + this.selectedCwbRefs().size + this.manualEntries().length
  );

  ngOnInit(): void {
    this.policyResults.set(this.data.policyLocations);
    this.cwbForm.patchValue({
      policyNumber: this.data.policyNumber,
      locationRuleNumber:
        this.data.locationRuleNumber ?? this.derivedRuleNumber(this.data.policyNumber)
    });
  }

  setTab(index: 0 | 1): void {
    this.activeTab.set(index);
  }

  private derivedRuleNumber(policyNumber: string): string {
    const m = /POL-(\d{4})-(\d+)/.exec(policyNumber);
    if (!m) return '';
    return `LRN-${m[1]}-PROP-${m[2].padStart(3, '0')}`;
  }

  // ── Policy tab ───────────────────────────────────────────────────────────
  onPolicySearch(): void {
    const { name, id, city } = this.policyForm.value;
    this.policyResults.set(
      this.data.policyLocations.filter(l => {
        if (name && !l.name.toLowerCase().includes(name.toLowerCase())) return false;
        if (id && !l.propertyId?.toLowerCase().includes(id.toLowerCase())) return false;
        if (city && !l.city.toLowerCase().includes(city.toLowerCase())) return false;
        return true;
      })
    );
  }

  onPolicyReset(): void {
    this.policyForm.reset();
    this.policyResults.set(this.data.policyLocations);
  }

  isPolicySelected(id: string): boolean {
    return this.selectedPolicyId() === id;
  }

  selectPolicyRow(id: string): void {
    this.selectedPolicyId.set(id);
  }

  // ── CWB tab ──────────────────────────────────────────────────────────────
  showError(field: string): boolean {
    const c = this.cwbForm.get(field);
    return !!c && c.invalid && c.touched;
  }

  get canSearchCwb(): boolean {
    const v = this.cwbForm.getRawValue();
    return !!v.policyNumber && !!v.locationRuleNumber && !!v.country;
  }

  onCwbSearch(): void {
    if (!this.canSearchCwb) {
      this.cwbForm.markAllAsTouched();
      return;
    }
    const v = this.cwbForm.getRawValue() as CwbSearchFilters;
    this.cwbSearchTrigger$.next({ ...v, geoCoordinates: '' });
  }

  onCwbReset(): void {
    this.cwbForm.patchValue({ country: '', city: '', postalCode: '', streetAndNumber: '' });
    this.selectedCwbRefs.set(new Set());
  }

  isCwbSelected(ref: string): boolean {
    return this.selectedCwbRefs().has(ref);
  }

  toggleCwbRow(ref: string, checked: boolean): void {
    const next = new Set(this.selectedCwbRefs());
    if (checked) next.add(ref);
    else next.delete(ref);
    this.selectedCwbRefs.set(next);
  }

  // ── Manual entry ─────────────────────────────────────────────────────────
  addManual(): void {
    this.manualSubmitted = true;
    if (this.manualForm.invalid) return;
    const v = this.manualForm.getRawValue();
    const entry: CwbManualAddress = {
      country: v.country,
      city: v.city,
      postalCode: v.postalCode,
      streetAndNumber: v.streetAndNumber,
      addressLine2: v.addressLine2 || undefined,
      state: v.state || undefined,
      notes: v.notes || undefined
    };
    this.manualEntries.set([...this.manualEntries(), entry]);
    this.manualForm.reset({
      country: '',
      city: '',
      postalCode: '',
      streetAndNumber: '',
      addressLine2: '',
      state: '',
      notes: ''
    });
    this.manualSubmitted = false;
  }

  removeManual(idx: number): void {
    this.manualEntries.set(this.manualEntries().filter((_, i) => i !== idx));
  }

  // ── Confirm / cancel ─────────────────────────────────────────────────────
  onCancel(): void {
    this.modalRef.close(null);
  }

  onConfirm(cwbResults: CwbLocation[]): void {
    if (!this.hasAnySelection()) return;
    const policyId = this.selectedPolicyId();
    const policy = policyId ? this.data.policyLocations.filter(l => l.id === policyId) : [];
    const refs = this.selectedCwbRefs();
    const cwb = cwbResults.filter(r => refs.has(r.cwbReference));
    this.modalRef.close({ policy, cwb, manual: this.manualEntries() });
  }
}
