import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { Observable, catchError, debounceTime, of, startWith, switchMap } from 'rxjs';
import { MockGisLocationService } from '../../../core/mock/services/mock-gis-location.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { GisAddressSuggestion, LookupOption } from '../../../core/models';

/**
 * Inline "New address" card: search an address, or tick "I want to put the
 * address manually". Same rules as the Add location modals (GIS pick fills
 * the address and locks street, postal code, city and country; the manual
 * tick unlocks them; number and province stay editable), laid out inline
 * for places that are not a modal. The composed one-line address is written
 * to `control`, so the host form stays a plain string.
 */
@Component({
  selector: 'app-new-address-entry',
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    NxButtonModule,
    NxCheckboxModule,
    NxDropdownModule,
    NxFormfieldModule,
    NxIconModule,
    NxInputModule
  ],
  templateUrl: './new-address-entry.component.html',
  styleUrl: './new-address-entry.component.scss'
})
export class NewAddressEntryComponent {
  /** Receives the composed address, e.g. "Dieselstrasse 55, 80333 Munich, DE". */
  readonly control = input.required<FormControl<string>>();
  /** Fired by the card's Remove button; the host decides what hiding the card means. */
  readonly removed = output<void>();

  private readonly gisSvc = inject(MockGisLocationService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[])
  );

  readonly gisSearch = new FormControl('', { nonNullable: true });
  readonly gisResults = toSignal(
    this.gisSearch.valueChanges.pipe(
      debounceTime(250),
      switchMap(q =>
        q.trim().length >= 2
          ? this.gisSvc.search(q).pipe(catchError(() => of([] as GisAddressSuggestion[])))
          : of([] as GisAddressSuggestion[])
      )
    ),
    { initialValue: [] as GisAddressSuggestion[] }
  );
  readonly picked = signal<GisAddressSuggestion | null>(null);
  readonly manual = signal(false);

  readonly form = new FormGroup({
    street: new FormControl('', { nonNullable: true }),
    number: new FormControl('', { nonNullable: true }),
    postalCode: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    country: new FormControl<string | null>(null),
    state: new FormControl('', { nonNullable: true })
  });

  readonly showGrid = computed(() => this.picked() !== null || this.manual());
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue()
  });

  constructor() {
    effect(() => {
      const v = this.value();
      const line1 = [v.street, v.number].filter(Boolean).join(' ');
      const line2 = [v.postalCode, v.city].filter(Boolean).join(' ');
      this.control().setValue([line1, line2, v.country].filter(Boolean).join(', '));
    });
  }

  select(s: GisAddressSuggestion): void {
    this.picked.set(s);
    this.gisSearch.setValue(s.formattedAddress, { emitEvent: false });
    this.form.patchValue({
      street: s.addressLine1,
      postalCode: s.postalCode,
      city: s.city,
      country: s.country,
      state: s.state ?? ''
    });
    this.syncLock();
  }

  clear(): void {
    this.gisSearch.setValue('', { emitEvent: false });
    this.picked.set(null);
    this.form.reset({ country: null });
    this.syncLock();
  }

  setManual(checked: boolean): void {
    this.manual.set(checked);
    this.syncLock();
  }

  // Derived by the search, so read-only until the user opts into typing them.
  private syncLock(): void {
    const locked = this.picked() !== null && !this.manual();
    for (const name of ['street', 'postalCode', 'city', 'country'] as const) {
      const c = this.form.controls[name];
      if (locked) c.disable();
      else c.enable();
    }
  }
}
