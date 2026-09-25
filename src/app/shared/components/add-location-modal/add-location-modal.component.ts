import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
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
    EmptyStateComponent
  ],
  templateUrl: './add-location-modal.component.html',
  styleUrl: './add-location-modal.component.scss'
})
export class AddLocationModalComponent implements OnInit {
  readonly data = inject<AddLocationModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<AddLocationModalComponent, AddLocationModalResult | null>>(NxModalRef);
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
  readonly hasSearched = signal(false);
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
  // "Add the address manually" — unlocks country/latitude/longitude for direct
  // editing instead of trusting whatever a GIS pick derived (reference,
  // 2026-09-25: those 3 fields render disabled/grey after a pick; the rest
  // — state/city/street/number/postal code — stay editable regardless, since
  // a geocode match only reliably gives country + coordinates).
  readonly addAddressManually = signal(false);

  readonly manualForm = new FormGroup({
    country: new FormControl<string | null>(null),
    state: new FormControl(''),
    city: new FormControl(''),
    street: new FormControl(''),
    number: new FormControl(''),
    postalCode: new FormControl(''),
    latitude: new FormControl<number | null>(null),
    longitude: new FormControl<number | null>(null),
    additionalInfo: new FormControl('')
  });
  readonly maxAdditionalInfo = 300;
  private readonly manualFormValue = toSignal(this.manualForm.valueChanges, {
    initialValue: this.manualForm.getRawValue()
  });
  readonly additionalInfoLength = computed(() => this.manualFormValue().additionalInfo?.length ?? 0);
  readonly hasManualData = computed(() => {
    const v = this.manualFormValue();
    return Object.values(v).some(val => val !== null && val !== '');
  });
  // Grid only appears once there's something to show it for — a GIS pick, or
  // the user opting into fully manual entry.
  readonly showManualGrid = computed(
    () => this.selectedGisSuggestion() !== null || this.addAddressManually()
  );

  // hasManualData() reads valueChanges, which omits disabled controls —
  // country/latitude/longitude go disabled once locked (syncDerivedFieldsLock),
  // so a pure GIS pick with no other field touched must be OR'd in separately.
  readonly hasManualEntry = computed(
    () => this.selectedGisSuggestion() !== null || this.hasManualData()
  );
  readonly hasAnySelection = computed(
    () => this.selectedPolicyId() !== null || this.hasManualEntry()
  );
  readonly addCount = computed(() => (this.selectedPolicyId() ? 1 : 0) + (this.hasManualEntry() ? 1 : 0));

  ngOnInit(): void {
    // Reference (production, 2026-09-25): body is empty until the user runs
    // a search — locations are not pre-listed on open.
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
    this.hasSearched.set(true);
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
    this.hasSearched.set(false);
    this.policyResults.set([]);
  }

  isPolicySelected(id: string): boolean {
    return this.selectedPolicyId() === id;
  }

  selectPolicyRow(id: string): void {
    this.selectedPolicyId.set(id);
  }

  // ── Add location manually ────────────────────────────────────────────────
  // A GIS pick only reliably derives country + coordinates (reference,
  // 2026-09-25) — the rest is left for the user to fill in, not overwritten.
  selectGisSuggestion(s: GisAddressSuggestion): void {
    this.selectedGisSuggestion.set(s);
    this.gisSearch.setValue(s.formattedAddress, { emitEvent: false });
    this.manualForm.patchValue({
      country: s.country,
      latitude: s.latitude,
      longitude: s.longitude
    });
    this.syncDerivedFieldsLock();
  }

  clearGisSearch(): void {
    this.gisSearch.setValue('', { emitEvent: false });
    this.selectedGisSuggestion.set(null);
    this.manualForm.patchValue({ country: null, latitude: null, longitude: null });
    this.syncDerivedFieldsLock();
  }

  toggleAddAddressManually(checked: boolean): void {
    this.addAddressManually.set(checked);
    this.syncDerivedFieldsLock();
  }

  // Country/latitude/longitude are locked (derived, read-only) whenever
  // they came from a GIS pick and the user hasn't opted into overriding
  // them — everything else is always editable.
  private syncDerivedFieldsLock(): void {
    const locked = this.selectedGisSuggestion() !== null && !this.addAddressManually();
    const controls = ['country', 'latitude', 'longitude'] as const;
    for (const name of controls) {
      const control = this.manualForm.get(name)!;
      if (locked) control.disable();
      else control.enable();
    }
  }

  // ── Confirm / cancel ─────────────────────────────────────────────────────
  onCancel(): void {
    this.modalRef.close(null);
  }

  onConfirm(): void {
    if (!this.hasAnySelection()) return;
    const policyId = this.selectedPolicyId();
    const policy = policyId ? this.data.policyLocations.filter(l => l.id === policyId) : [];
    const manual: CwbManualAddress[] = [];
    if (this.hasManualEntry()) {
      const v = this.manualForm.getRawValue();
      manual.push({
        country: v.country ?? '',
        city: v.city ?? '',
        postalCode: v.postalCode ?? '',
        streetAndNumber: [v.street, v.number].filter(Boolean).join(' '),
        state: v.state || undefined,
        notes: v.additionalInfo || undefined,
        latitude: v.latitude ?? undefined,
        longitude: v.longitude ?? undefined
      });
    }
    this.modalRef.close({ policy, manual });
  }
}
