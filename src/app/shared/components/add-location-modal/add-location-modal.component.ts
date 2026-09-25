import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { Observable, catchError, of, startWith, debounceTime, switchMap } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockGisLocationService } from '../../../core/mock/services/mock-gis-location.service';
import {
  PolicyLocation,
  CwbManualAddress,
  AddLocationModalResult,
  GisAddressSuggestion,
  LookupOption
} from '../../../core/models';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ManualAddressSectionComponent } from './manual-address-section/manual-address-section.component';

export interface AddLocationModalData {
  policyNumber: string;
  locationRuleNumber?: string;
  policyLocations: PolicyLocation[];
}

type Screen = 'policy' | 'manual';

@Component({
  selector: 'app-add-location-modal',
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
    NxRadioModule,
    NxTableModule,
    NxCheckboxModule,
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
  private readonly lookupSvc = inject(MockLookupService);
  private readonly gisSvc = inject(MockGisLocationService);

  // Two linked screens (production reference, 2026-09-25), not tabs — "Add
  // location from policy" and "Add location manually" each link to the
  // other via a text button, matching what production actually does.
  readonly screen = signal<Screen>('policy');

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[])
  );

  // ── Screen: Add location from policy ────────────────────────────────────
  readonly policyForm = new FormGroup({
    country: new FormControl<string | null>(null),
    state: new FormControl(''),
    city: new FormControl(''),
    street: new FormControl(''),
    number: new FormControl(''),
    postalCode: new FormControl('')
  });
  readonly policyResults = signal<PolicyLocation[]>([]);
  readonly selectedPolicyId = signal<string | null>(null);

  // ── Screen: Add location manually ───────────────────────────────────────
  // GIS address search — a plain free-text lookup, independent of the
  // policy (same mechanism the orphan-claim location entry already uses —
  // see ManualLocationEntryModalComponent).
  readonly gisSearch = new FormControl('');
  readonly gisResults = toSignal(
    this.gisSearch.valueChanges.pipe(
      debounceTime(250),
      switchMap(q =>
        q && q.trim().length >= 2
          ? this.gisSvc.search(q).pipe(catchError(() => of([] as GisAddressSuggestion[])))
          : of([] as GisAddressSuggestion[])
      )
    ),
    { initialValue: [] as GisAddressSuggestion[] }
  );
  readonly selectedGisSuggestion = signal<GisAddressSuggestion | null>(null);
  readonly addAddressManually = signal(false);

  readonly manualForm: FormGroup = this.fb.group({
    country: [''],
    city: [''],
    postalCode: [''],
    streetAndNumber: [''],
    addressLine2: [''],
    state: [''],
    notes: ['']
  });
  manualSubmitted = false;
  readonly manualEntries = signal<CwbManualAddress[]>([]);

  readonly hasAnySelection = computed(
    () =>
      this.selectedPolicyId() !== null ||
      this.selectedGisSuggestion() !== null ||
      this.manualEntries().length > 0
  );
  readonly addCount = computed(
    () =>
      (this.selectedPolicyId() ? 1 : 0) +
      (this.selectedGisSuggestion() ? 1 : 0) +
      this.manualEntries().length
  );

  ngOnInit(): void {
    this.policyResults.set(this.data.policyLocations);
  }

  goToManual(): void {
    this.screen.set('manual');
  }
  goToPolicy(): void {
    this.screen.set('policy');
  }

  // ── Add location from policy ─────────────────────────────────────────────
  onPolicySearch(): void {
    const { country, state, city, street, number, postalCode } = this.policyForm.value;
    const streetQuery = [street, number].filter(Boolean).join(' ').toLowerCase();
    this.policyResults.set(
      this.data.policyLocations.filter(l => {
        if (country && l.country !== country) return false;
        if (state && !l.state?.toLowerCase().includes(state.toLowerCase())) return false;
        if (city && !l.city.toLowerCase().includes(city.toLowerCase())) return false;
        if (streetQuery && !l.addressLine1.toLowerCase().includes(streetQuery)) return false;
        if (postalCode && !l.postalCode.toLowerCase().includes(postalCode.toLowerCase()))
          return false;
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

  // ── Add location manually ────────────────────────────────────────────────
  selectGisSuggestion(s: GisAddressSuggestion): void {
    this.selectedGisSuggestion.set(s);
    this.gisSearch.setValue(s.formattedAddress, { emitEvent: false });
  }

  toggleAddAddressManually(checked: boolean): void {
    this.addAddressManually.set(checked);
  }

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

  onConfirm(): void {
    if (!this.hasAnySelection()) return;
    const policyId = this.selectedPolicyId();
    const policy = policyId ? this.data.policyLocations.filter(l => l.id === policyId) : [];
    const gis = this.selectedGisSuggestion();
    const manual: CwbManualAddress[] = gis
      ? [
          ...this.manualEntries(),
          {
            country: gis.country,
            city: gis.city,
            postalCode: gis.postalCode,
            streetAndNumber: gis.addressLine1,
            state: gis.state
          }
        ]
      : this.manualEntries();
    this.modalRef.close({ policy, manual });
  }
}
