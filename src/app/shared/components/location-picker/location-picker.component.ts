import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, Observable, of, firstValueFrom } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import { MockPolicyLocationService } from '../../../core/mock/services/mock-policy-location.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { PolicyLocation, LocationItem, LocationPickerOutput, LookupOption } from '../../../core/models';
import {
  PolicyLocationSearchModalComponent,
  PolicyLocationSearchModalResult,
} from '../policy-location-search-modal/policy-location-search-modal.component';
import {
  ManualLocationEntryModalComponent,
  ManualLocationEntryModalData,
  ManualLocationEntryModalResult,
} from '../manual-location-entry-modal/manual-location-entry-modal.component';

interface LocationPickerVM {
  countries: LookupOption[];
  policyLocations: PolicyLocation[];
  policyLoadError: boolean;
}

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxContextMenuModule,
    NxMessageModule,
    NxTableModule,
  ],
  templateUrl: './location-picker.component.html',
  styleUrl:    './location-picker.component.scss',
})
export class LocationPickerComponent implements OnInit {
  @Input() policyNumber: string | null | undefined = null;
  @Input() value: LocationPickerOutput | null = null;
  /** FNOL only — shows the "you can add/update later via Edit Claim" hint.
   *  Off on the Edit Claim screen itself (where that hint would be circular). */
  @Input() showEditLaterHint = false;
  @Output() locationChange = new EventEmitter<LocationPickerOutput>();

  private policyLocationSvc = inject(MockPolicyLocationService);
  private lookupSvc         = inject(MockLookupService);
  private dialogSvc         = inject(NxDialogService);

  hasPolicyNumber = false;
  locations: LocationItem[] = [];

  private allPolicyLocations: PolicyLocation[] = [];
  vm$!: Observable<LocationPickerVM>;

  ngOnInit(): void {
    this.hasPolicyNumber = !!this.policyNumber;
    if (this.value?.locations?.length) this.locations = this.value.locations;

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

  /**
   * Single entry point. Host picks the right modal based on context:
   *   - has policy → open PolicyLocationSearch first; if user falls back, chain ManualEntry
   *   - no policy (skeleton) → open ManualEntry directly
   */
  async addLocation(policyLocations: PolicyLocation[] = []): Promise<void> {
    this.allPolicyLocations = policyLocations;
    if (!this.hasPolicyNumber) { await this.openManualEntry(); return; }
    await this.openPolicySearchOrFallback();
  }

  editItem(item: LocationItem): void { void this.openManualEntry(item); }

  removeItem(id: string): void {
    this.locations = this.locations.filter(l => l.id !== id);
    this._emit();
  }

  private async openPolicySearchOrFallback(seedQuery?: string): Promise<void> {
    const ref = this.dialogSvc.open<
      PolicyLocationSearchModalComponent,
      { policyNumber: string; policyLocations: PolicyLocation[] },
      PolicyLocationSearchModalResult
    >(PolicyLocationSearchModalComponent, {
      data: { policyNumber: this.policyNumber!, policyLocations: this.allPolicyLocations },
      panelClass: 'me-edit-modal-panel',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    if (result.kind === 'fallback-manual') {
      await this.openManualEntry(undefined, result.seedQuery ?? seedQuery);
      return;
    }

    const items: LocationItem[] = result.locations.map(l => ({
      id:                this._newId(),
      source:            'policy',
      displayName:       l.name,
      addressLine1:      l.addressLine1,
      addressLine2:      l.addressLine2,
      postalCode:        l.postalCode,
      city:              l.city,
      country:           l.country,
      state:             l.state,
      propertyId:        l.propertyId,
      policyLocationRef: l.id,
    }));
    this._commitItems(items);
  }

  private async openManualEntry(seed?: LocationItem, seedQuery?: string): Promise<void> {
    const ref = this.dialogSvc.open<
      ManualLocationEntryModalComponent,
      ManualLocationEntryModalData,
      ManualLocationEntryModalResult
    >(ManualLocationEntryModalComponent, {
      data: { seed: seed ?? (seedQuery ? this._seedFromQuery(seedQuery) : undefined) },
      width: '720px',
      maxWidth: '95vw',
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    if (seed) {
      this.locations = this.locations.map(l => l.id === seed.id ? result : l);
      this._emit();
    } else {
      this._commitItems([result]);
    }
  }

  private _seedFromQuery(query: string): LocationItem {
    return {
      id: this._newId(),
      source: 'manual',
      displayName: query,
      addressLine1: query,
      postalCode: '',
      city: '',
      country: '',
    };
  }

  private _commitItems(items: LocationItem[]): void {
    // Single-location-only: a newly picked location replaces whatever was there.
    this.locations = items.slice(0, 1);
    this._emit();
  }

  private _emit(): void { this.locationChange.emit({ locations: this.locations }); }

  private _newId(): string { return 'loc-' + Math.random().toString(36).slice(2, 9); }
}
