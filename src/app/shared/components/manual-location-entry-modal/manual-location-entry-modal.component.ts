import { Component, OnInit, inject, effect } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, catchError, of, startWith } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { LocationItem, LookupOption } from '../../../core/models';

type EntryMode = 'address' | 'coordinates';

export interface ManualLocationEntryModalData {
  seed?: LocationItem;
}

export type ManualLocationEntryModalResult = LocationItem | null;

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
    NxRadioModule,
  ],
  templateUrl: './manual-location-entry-modal.component.html',
  styleUrl: './manual-location-entry-modal.component.scss',
})
export class ManualLocationEntryModalComponent implements OnInit {
  readonly data     = inject<ManualLocationEntryModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ManualLocationEntryModalComponent, ManualLocationEntryModalResult>>(NxModalRef);
  private lookupSvc = inject(MockLookupService);

  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[]),
  );

  readonly form = new FormGroup({
    mode:           new FormControl<EntryMode>('address', { nonNullable: true }),
    addressLine1:   new FormControl('',                  [Validators.required]),
    addressLine2:   new FormControl(''),
    postalCode:     new FormControl('',                  [Validators.required]),
    city:           new FormControl('',                  [Validators.required]),
    country:        new FormControl<string | null>(null, [Validators.required]),
    state:          new FormControl(''),
    propertyId:     new FormControl(''),
    latitude:       new FormControl<number | null>(null),
    longitude:      new FormControl<number | null>(null),
    additionalInfo: new FormControl('',                  [Validators.maxLength(300)]),
  });

  submitted = false;

  private readonly mode = toSignal(this.form.get('mode')!.valueChanges, {
    initialValue: this.form.get('mode')!.value,
  });

  get isEdit(): boolean { return !!this.data.seed; }
  get isCoordinatesMode(): boolean { return this.mode() === 'coordinates'; }
  get descLength(): number {
    return (this.form.get('additionalInfo')?.value as string)?.length ?? 0;
  }

  constructor() {
    // Swap required validators between the two modes so a coordinates-only
    // entry doesn't need a street address, and vice versa.
    effect(() => {
      const coords = this.isCoordinatesMode;
      const addressCtrls = [this.form.get('addressLine1')!, this.form.get('postalCode')!, this.form.get('city')!];
      const coordCtrls = [this.form.get('latitude')!, this.form.get('longitude')!];
      addressCtrls.forEach(c => { c.setValidators(coords ? [] : [Validators.required]); c.updateValueAndValidity(); });
      coordCtrls.forEach(c => { c.setValidators(coords ? [Validators.required] : []); c.updateValueAndValidity(); });
    });
  }

  ngOnInit(): void {
    const s = this.data.seed;
    if (!s) return;
    this.form.reset({
      mode:           s.source === 'coordinates' ? 'coordinates' : 'address',
      addressLine1:   s.addressLine1,
      addressLine2:   s.addressLine2 ?? '',
      postalCode:     s.postalCode,
      city:           s.city,
      country:        s.country,
      state:          s.state ?? '',
      propertyId:     s.propertyId ?? '',
      latitude:       s.latitude ?? null,
      longitude:      s.longitude ?? null,
      additionalInfo: s.additionalInfo ?? '',
    });
  }

  onCancel(): void { this.modalRef.close(null); }

  onConfirm(): void {
    this.submitted = true;
    if (this.form.invalid) return;
    const v = this.form.value;
    const coords = v.mode === 'coordinates';
    // Only one mode's fields are ever meaningful — drop the other mode's
    // values so switching Address <-> Coordinates never leaves stale data
    // (e.g. a previous address) saved alongside the new entry.
    const item: LocationItem = {
      id:             this.data.seed?.id ?? this._newId(),
      source:         coords ? 'coordinates' : 'manual',
      displayName:    coords ? `${v.latitude}, ${v.longitude}` : `${v.addressLine1}, ${v.city}`,
      addressLine1:   coords ? '' : (v.addressLine1 || ''),
      addressLine2:   coords ? undefined : (v.addressLine2 || undefined),
      postalCode:     coords ? '' : (v.postalCode || ''),
      city:           coords ? '' : (v.city || ''),
      country:        v.country!,
      state:          coords ? undefined : (v.state || undefined),
      propertyId:     v.propertyId || undefined,
      // In address mode, latitude/longitude are still optional extras (see
      // "Optional details") — only coordinates mode requires them.
      latitude:       v.latitude ?? undefined,
      longitude:      v.longitude ?? undefined,
      additionalInfo: v.additionalInfo || undefined,
    };
    this.modalRef.close(item);
  }

  private _newId(): string {
    return 'loc-' + Math.random().toString(36).slice(2, 9);
  }
}
