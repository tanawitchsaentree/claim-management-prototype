import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, catchError, of, startWith } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { LocationItem, LookupOption } from '../../../core/models';

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

  get isEdit(): boolean { return !!this.data.seed; }
  get descLength(): number {
    return (this.form.get('additionalInfo')?.value as string)?.length ?? 0;
  }

  ngOnInit(): void {
    const s = this.data.seed;
    if (!s) return;
    this.form.reset({
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
    const item: LocationItem = {
      id:             this.data.seed?.id ?? this._newId(),
      source:         'manual',
      displayName:    `${v.addressLine1}, ${v.city}`,
      addressLine1:   v.addressLine1!,
      addressLine2:   v.addressLine2 || undefined,
      postalCode:     v.postalCode!,
      city:           v.city!,
      country:        v.country!,
      state:          v.state || undefined,
      propertyId:     v.propertyId || undefined,
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
