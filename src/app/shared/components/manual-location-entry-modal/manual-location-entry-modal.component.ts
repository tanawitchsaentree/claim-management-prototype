import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, catchError, debounceTime, of, startWith, switchMap } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { MockGisLocationService } from '../../../core/mock/services/mock-gis-location.service';
import { GisAddressSuggestion, LocationItem, LookupOption } from '../../../core/models';

export interface ManualLocationEntryModalData {
  seed?: LocationItem;
}

export type ManualLocationEntryModalResult = LocationItem | null;

/**
 * 2026-10-01: rebuilt to match AddLocationModalComponent's "Add location
 * manually" screen field-for-field (that screen is itself verified against
 * the real production reference, 2026-09-25) — this modal and that one are
 * the same conceptual action gated on a different source list (no policy
 * here), they should never have diverged in field set/layout. Dropped: the
 * "Entry method: Address/Coordinates" radio (not in the reference —
 * latitude/longitude are just two more fields in the one grid), the
 * addressLine1/2 split, and the collapsible "Optional details" section.
 */
@Component({
  selector: 'app-manual-location-entry-modal',
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
    NxCheckboxModule
  ],
  templateUrl: './manual-location-entry-modal.component.html',
  styleUrl: './manual-location-entry-modal.component.scss'
})
export class ManualLocationEntryModalComponent implements OnInit {
  readonly data = inject<ManualLocationEntryModalData>(NX_MODAL_DATA);
  readonly modalRef =
    inject<NxModalRef<ManualLocationEntryModalComponent, ManualLocationEntryModalResult>>(
      NxModalRef
    );
  private lookupSvc = inject(MockLookupService);
  private gisSvc = inject(MockGisLocationService);

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[])
  );

  // GIS address search — a plain address lookup, not tied to any policy.
  // Not part of `form`: it only ever feeds the address fields below, it is
  // never itself submitted.
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

  readonly form = new FormGroup({
    country: new FormControl<string | null>(null),
    state: new FormControl(''),
    city: new FormControl(''),
    street: new FormControl(''),
    number: new FormControl(''),
    postalCode: new FormControl(''),
    latitude: new FormControl<number | null>(null),
    longitude: new FormControl<number | null>(null),
    additionalInfo: new FormControl('', [Validators.maxLength(300)])
  });

  // "Add the address manually" — unlocks country/latitude/longitude for direct
  // editing instead of trusting whatever a GIS pick derived (reference,
  // 2026-09-25: those 3 fields render disabled/grey after a pick; the rest
  // — state/city/street/number/postal code — stay editable regardless, since
  // a geocode match only reliably gives country + coordinates).
  readonly addAddressManually = signal(false);

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue()
  });
  readonly descLength = computed(() => this.formValue().additionalInfo?.length ?? 0);
  readonly hasManualData = computed(() => {
    const v = this.formValue();
    return Object.values(v).some(val => val !== null && val !== '');
  });

  // Grid only appears once there's something to show it for — a GIS pick, or
  // the user opting into fully manual entry. Editing an existing entry always
  // shows the grid immediately; there's nothing to search for that case.
  readonly showManualGrid = computed(
    () => this.selectedGisSuggestion() !== null || this.addAddressManually() || this.isEdit
  );
  readonly canConfirm = computed(
    () => this.selectedGisSuggestion() !== null || this.hasManualData()
  );

  get isEdit(): boolean {
    return !!this.data.seed;
  }

  ngOnInit(): void {
    const s = this.data.seed;
    if (!s) return;
    // Can't losslessly split a single stored addressLine1 back into
    // separate Street/Number fields — the whole stored line goes into
    // Street, Number stays blank. Still round-trips correctly: onConfirm
    // rejoins street+number back into one addressLine1 on save.
    this.form.reset({
      street: s.addressLine1,
      number: '',
      postalCode: s.postalCode,
      city: s.city,
      country: s.country,
      state: s.state ?? '',
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      additionalInfo: s.additionalInfo ?? ''
    });
  }

  // A GIS pick only reliably derives country + coordinates (reference,
  // 2026-09-25) — the rest is left for the user to fill in, not overwritten.
  selectSuggestion(s: GisAddressSuggestion): void {
    this.selectedGisSuggestion.set(s);
    this.gisSearch.setValue(s.formattedAddress, { emitEvent: false });
    this.form.patchValue({
      country: s.country,
      latitude: s.latitude,
      longitude: s.longitude
    });
    this.syncDerivedFieldsLock();
  }

  clearGisSearch(): void {
    this.gisSearch.setValue('', { emitEvent: false });
    this.selectedGisSuggestion.set(null);
    this.form.patchValue({ country: null, latitude: null, longitude: null });
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
      const control = this.form.get(name)!;
      if (locked) control.disable();
      else control.enable();
    }
  }

  onCancel(): void {
    this.modalRef.close(null);
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    const v = this.form.getRawValue();
    const addressLine1 = [v.street, v.number].filter(Boolean).join(' ');
    const item: LocationItem = {
      id: this.data.seed?.id ?? this._newId(),
      source: 'manual',
      displayName: [addressLine1, v.city].filter(Boolean).join(', '),
      addressLine1,
      postalCode: v.postalCode || '',
      city: v.city || '',
      country: v.country ?? '',
      state: v.state || undefined,
      latitude: v.latitude ?? undefined,
      longitude: v.longitude ?? undefined,
      additionalInfo: v.additionalInfo || undefined
    };
    this.modalRef.close(item);
  }

  private _newId(): string {
    return 'loc-' + Math.random().toString(36).slice(2, 9);
  }
}
