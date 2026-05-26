import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable, ReplaySubject, switchMap, catchError, of, map, startWith } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { MockCwbService } from '../../../core/mock/services/mock-cwb.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import {
  CwbLocation,
  CwbSearchFilters,
  CwbManualAddress,
  CwbModalResult,
  LookupOption,
} from '../../../core/models';

export interface CwbLocationSearchModalData {
  policyNumber: string;
  locationRuleNumber?: string;
}

interface SearchState {
  results: CwbLocation[];
  loading: boolean;
  error: boolean;
  searched: boolean;
}

@Component({
  selector: 'app-cwb-location-search-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxCheckboxModule,
    NxSpinnerModule,
    NxMessageModule,
  ],
  templateUrl: './cwb-location-search-modal.component.html',
  styleUrl: './cwb-location-search-modal.component.scss',
})
export class CwbLocationSearchModalComponent implements OnInit {
  readonly data     = inject<CwbLocationSearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<CwbLocationSearchModalComponent, CwbModalResult | null>>(NxModalRef);
  private readonly fb        = inject(FormBuilder);
  private readonly cwbSvc    = inject(MockCwbService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[]),
  );

  // ── Search form (top section) ───────────────────────────────────────────
  readonly form: FormGroup = this.fb.group({
    policyNumber:       [{ value: '', disabled: true }, Validators.required],
    locationRuleNumber: [{ value: '', disabled: true }, Validators.required],
    country:            ['', Validators.required],
    city:               [''],
    postalCode:         [''],
    streetAndNumber:    [''],
  });

  // ── Manual entry form (bottom section) ──────────────────────────────────
  readonly manualForm: FormGroup = this.fb.group({
    country:         ['', Validators.required],
    city:            ['', Validators.required],
    postalCode:      ['', Validators.required],
    streetAndNumber: ['', Validators.required],
    addressLine2:    [''],
    state:           [''],
    notes:           ['', Validators.maxLength(300)],
  });

  manualSubmitted = false;

  // ── Multi-selection ─────────────────────────────────────────────────────
  readonly selectedRefs    = signal<Set<string>>(new Set());
  readonly manualEntries   = signal<CwbManualAddress[]>([]);

  readonly hasAnySelection = computed(() =>
    this.selectedRefs().size > 0 || this.manualEntries().length > 0,
  );

  readonly addCount = computed(() =>
    this.selectedRefs().size + this.manualEntries().length,
  );

  // ── Search pipeline ─────────────────────────────────────────────────────
  private readonly searchTrigger$ = new ReplaySubject<CwbSearchFilters>(1);
  readonly state$: Observable<SearchState> = this.searchTrigger$.pipe(
    switchMap(filters =>
      this.cwbSvc.search(filters).pipe(
        map((results): SearchState => ({ results, loading: false, error: false, searched: true })),
        catchError((): Observable<SearchState> =>
          of({ results: [], loading: false, error: true, searched: true })),
        startWith({ results: [], loading: true, error: false, searched: false } as SearchState),
      ),
    ),
    startWith({ results: [], loading: false, error: false, searched: false } as SearchState),
  );

  ngOnInit(): void {
    this.form.patchValue({
      policyNumber:       this.data.policyNumber,
      locationRuleNumber: this.data.locationRuleNumber ?? this.derivedRuleNumber(this.data.policyNumber),
    });
  }

  private derivedRuleNumber(policyNumber: string): string {
    const m = /POL-(\d{4})-(\d+)/.exec(policyNumber);
    if (!m) return '';
    return `LRN-${m[1]}-PROP-${m[2].padStart(3, '0')}`;
  }

  // ── Search ──────────────────────────────────────────────────────────────
  showError(field: string, formRef: 'main' | 'manual' = 'main'): boolean {
    const c = (formRef === 'main' ? this.form : this.manualForm).get(field);
    return !!c && c.invalid && (c.touched || (formRef === 'manual' && this.manualSubmitted));
  }

  get canSearch(): boolean {
    const v = this.form.getRawValue();
    return !!v.policyNumber && !!v.locationRuleNumber && !!v.country;
  }

  onSearch(): void {
    if (!this.canSearch) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue() as CwbSearchFilters;
    this.searchTrigger$.next({ ...v, geoCoordinates: '' });
  }

  onReset(): void {
    this.form.patchValue({ country: '', city: '', postalCode: '', streetAndNumber: '' });
    this.selectedRefs.set(new Set());
  }

  // ── Multi-select toggle ─────────────────────────────────────────────────
  isSelected(ref: string): boolean {
    return this.selectedRefs().has(ref);
  }

  toggleRow(ref: string, checked: boolean): void {
    const next = new Set(this.selectedRefs());
    if (checked) next.add(ref);
    else next.delete(ref);
    this.selectedRefs.set(next);
  }

  // ── Manual entry ────────────────────────────────────────────────────────
  addManual(): void {
    this.manualSubmitted = true;
    if (this.manualForm.invalid) return;
    const v = this.manualForm.getRawValue();
    const entry: CwbManualAddress = {
      country:         v.country,
      city:            v.city,
      postalCode:      v.postalCode,
      streetAndNumber: v.streetAndNumber,
      addressLine2:    v.addressLine2 || undefined,
      state:           v.state || undefined,
      notes:           v.notes || undefined,
    };
    this.manualEntries.set([...this.manualEntries(), entry]);
    this.manualForm.reset({ country: '', city: '', postalCode: '', streetAndNumber: '', addressLine2: '', state: '', notes: '' });
    this.manualSubmitted = false;
  }

  removeManual(idx: number): void {
    this.manualEntries.set(this.manualEntries().filter((_, i) => i !== idx));
  }

  // ── Confirm / cancel ────────────────────────────────────────────────────
  onCancel(): void {
    this.modalRef.close(null);
  }

  onConfirm(results: CwbLocation[]): void {
    if (!this.hasAnySelection()) return;
    const refs = this.selectedRefs();
    const cwb  = results.filter(r => refs.has(r.cwbReference));
    this.modalRef.close({ cwb, manual: this.manualEntries() });
  }
}
