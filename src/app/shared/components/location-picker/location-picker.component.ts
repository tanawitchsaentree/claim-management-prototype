import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { MockPolicyLocationService } from '../../../core/mock/services/mock-policy-location.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { PolicyLocation, LocationItem, LocationPickerOutput, LookupOption } from '../../../core/models';

interface LocationPickerVM {
  countries: LookupOption[];
  policyLocations: PolicyLocation[];
  policyLoadError: boolean;
}

type PickerState = 'initial' | 'adding' | 'selected';
type AddMode    = 'find-in-policy' | 'manual';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxFormfieldModule,
    NxInputModule,
    NxIconModule,
    NxRadioModule,
    NxDropdownModule,
    NxCheckboxModule,
    NxContextMenuModule,
    NxMessageModule,
  ],
  templateUrl: './location-picker.component.html',
  styleUrl:    './location-picker.component.scss',
})
export class LocationPickerComponent implements OnInit {
  @Input() policyNumber: string | null | undefined = null;
  @Input() value: LocationPickerOutput | null = null;
  @Output() locationChange = new EventEmitter<LocationPickerOutput>();

  private policyLocationSvc = inject(MockPolicyLocationService);
  private lookupSvc         = inject(MockLookupService);

  // ── State ────────────────────────────────────────────────────────────
  state: PickerState = 'initial';
  addMode: AddMode   = 'find-in-policy';
  hasPolicyNumber    = false;

  locations: LocationItem[] = [];
  editingId: string | null  = null;

  // ── Policy search ────────────────────────────────────────────────────
  private allPolicyLocations: PolicyLocation[] = [];
  filteredLocations: PolicyLocation[] = [];
  selectedPolicyIds = new Set<string>();

  readonly searchForm = new FormGroup({
    name:    new FormControl(''),
    id:      new FormControl(''),
    city:    new FormControl(''),
    country: new FormControl<string | null>(null),
  });

  // ── Manual entry ─────────────────────────────────────────────────────
  readonly manualForm = new FormGroup({
    addressLine1:   new FormControl('',              [Validators.required]),
    addressLine2:   new FormControl(''),
    postalCode:     new FormControl('',              [Validators.required]),
    city:           new FormControl('',              [Validators.required]),
    country:        new FormControl<string | null>(null, [Validators.required]),
    state:          new FormControl(''),
    propertyId:     new FormControl(''),
    latitude:       new FormControl<number | null>(null),
    longitude:      new FormControl<number | null>(null),
    additionalInfo: new FormControl('',              [Validators.maxLength(300)]),
  });

  manualSubmitted = false;

  vm$!: Observable<LocationPickerVM>;

  ngOnInit(): void {
    this.hasPolicyNumber = !!this.policyNumber;
    this.addMode = this.hasPolicyNumber ? 'find-in-policy' : 'manual';

    if (this.value?.locations?.length) {
      this.locations = this.value.locations;
      this.state = 'selected';
    }

    const policyLocations$ = this.hasPolicyNumber
      ? this.policyLocationSvc.getByPolicyNumber(this.policyNumber!).pipe(
          catchError(() => of([] as PolicyLocation[]))
        )
      : of([] as PolicyLocation[]);

    this.vm$ = combineLatest({
      countries:       this.lookupSvc.getCountries(),
      policyLocations: policyLocations$,
      policyLoadError: policyLocations$.pipe(
        map(() => false),
        startWith(false),
        catchError(() => of(true))
      ),
    });

  }

  // ── State transitions ────────────────────────────────────────────────

  openAdding(policyLocations: PolicyLocation[] = []): void {
    this.editingId           = null;
    this.manualSubmitted     = false;
    this.allPolicyLocations  = policyLocations;
    this.manualForm.reset();
    this.selectedPolicyIds.clear();
    this.filteredLocations = policyLocations;
    this.searchForm.reset();
    this.state   = 'adding';
    this.addMode = this.hasPolicyNumber ? 'find-in-policy' : 'manual';
  }

  cancelAdding(): void {
    this.state = this.locations.length > 0 ? 'selected' : 'initial';
  }

  setAddMode(mode: AddMode): void {
    this.addMode = mode;
  }

  // ── Policy search ────────────────────────────────────────────────────

  onSearch(policyLocations: PolicyLocation[]): void {
    const { name, id, city, country } = this.searchForm.value;
    this.filteredLocations = policyLocations.filter(l => {
      if (name    && !l.name.toLowerCase().includes(name.toLowerCase()))       return false;
      if (id      && !l.propertyId?.toLowerCase().includes(id.toLowerCase()))  return false;
      if (city    && !l.city.toLowerCase().includes(city.toLowerCase()))        return false;
      if (country && l.country !== country)                                     return false;
      return true;
    });
  }

  onResetSearch(policyLocations: PolicyLocation[]): void {
    this.searchForm.reset();
    this.filteredLocations = policyLocations;
  }

  togglePolicyLocation(id: string): void {
    this.selectedPolicyIds.has(id)
      ? this.selectedPolicyIds.delete(id)
      : this.selectedPolicyIds.add(id);
  }

  isPolicyLocationSelected(id: string): boolean {
    return this.selectedPolicyIds.has(id);
  }

  confirmPolicySelection(): void {
    const picked = this.allPolicyLocations.filter(l => this.selectedPolicyIds.has(l.id));
    const newItems: LocationItem[] = picked.map(l => ({
      id:               this._newId(),
      source:           'policy',
      displayName:      l.name,
      addressLine1:     l.addressLine1,
      addressLine2:     l.addressLine2,
      postalCode:       l.postalCode,
      city:             l.city,
      country:          l.country,
      state:            l.state,
      propertyId:       l.propertyId,
      policyLocationRef: l.id,
    }));
    this._commitItems(newItems);
  }

  // ── Manual entry ─────────────────────────────────────────────────────

  confirmManual(): void {
    this.manualSubmitted = true;
    if (this.manualForm.invalid) return;

    const v = this.manualForm.value;
    const item: LocationItem = {
      id:             this.editingId ?? this._newId(),
      source:         'manual',
      displayName:    v.addressLine1 + ', ' + v.city,
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

    if (this.editingId) {
      this.locations = this.locations.map(l => l.id === this.editingId ? item : l);
    } else {
      this.locations = [...this.locations, item];
    }
    this._emit();
    this.state = 'selected';
  }

  // ── Edit / remove ────────────────────────────────────────────────────

  editItem(item: LocationItem): void {
    this.editingId       = item.id;
    this.manualSubmitted = false;
    this.addMode         = 'manual';
    this.manualForm.reset({
      addressLine1:   item.addressLine1,
      addressLine2:   item.addressLine2 ?? '',
      postalCode:     item.postalCode,
      city:           item.city,
      country:        item.country,
      state:          item.state ?? '',
      propertyId:     item.propertyId ?? '',
      latitude:       item.latitude ?? null,
      longitude:      item.longitude ?? null,
      additionalInfo: item.additionalInfo ?? '',
    });
    this.state = 'adding';
  }

  removeItem(id: string): void {
    this.locations = this.locations.filter(l => l.id !== id);
    this._emit();
    if (this.locations.length === 0) this.state = 'initial';
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  get addButtonLabel(): string {
    return this.selectedPolicyIds.size > 1
      ? `Add ${this.selectedPolicyIds.size} locations`
      : 'Add location';
  }

  get descLength(): number {
    return (this.manualForm.get('additionalInfo')?.value as string)?.length ?? 0;
  }

  private _commitItems(items: LocationItem[]): void {
    this.locations = [...this.locations, ...items];
    this._emit();
    this.state = 'selected';
  }

  private _emit(): void {
    this.locationChange.emit({ locations: this.locations });
  }

  private _newId(): string {
    return 'loc-' + Math.random().toString(36).slice(2, 9);
  }
}
