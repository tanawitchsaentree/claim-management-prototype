import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Observable, of, ReplaySubject, switchMap, map, catchError, startWith } from 'rxjs';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { MockBrokerService } from '../../../core/mock/services/mock-broker.service';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';
import { Broker, BrokerSearchFilters, BrokerPartyType, LookupOption } from '../../../core/models';
import { StatusChipComponent } from '../status-chip/status-chip.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface BrokerSearchModalData { initialQuery?: string; }
export type BrokerSearchModalResult = Broker | null;

interface SearchState {
  results: Broker[];
  loading: boolean;
  error:   boolean;
  searched: boolean;
}

const ID_TYPES = ['IPM', 'NAIC', 'Internal ref'];

@Component({
  selector: 'app-broker-search-modal',
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
    NxRadioModule,
    NxSpinnerModule,
    NxMessageModule,
    NxTabsModule,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './broker-search-modal.component.html',
  styleUrl: './broker-search-modal.component.scss',
})
export class BrokerSearchModalComponent implements OnInit {
  readonly data     = inject<BrokerSearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<BrokerSearchModalComponent, BrokerSearchModalResult>>(NxModalRef);
  private readonly fb        = inject(FormBuilder);
  private readonly brokerSvc = inject(MockBrokerService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly idTypes = ID_TYPES;
  readonly countries$: Observable<LookupOption[]> = this.lookupSvc.getCountries().pipe(
    catchError(() => of([] as LookupOption[])),
    startWith([] as LookupOption[]),
  );

  readonly partyType = signal<BrokerPartyType>('company');

  readonly form: FormGroup = this.fb.group({
    legalName: [''],
    firstName: [''],
    lastName:  [''],
    country:   [''],
    role:      ['Broker'],
    number:    [''],
    zipCode:   [''],
    street:    [''],
    state:     [''],
    city:      [''],
    idType:    [''],
    idValue:   [''],
  });

  readonly selectedId = signal<string | null>(null);
  readonly showAdvanced = signal(false);

  toggleAdvanced(): void {
    this.showAdvanced.update(v => !v);
  }

  private readonly searchTrigger$ = new ReplaySubject<BrokerSearchFilters>(1);
  readonly state$: Observable<SearchState> = this.searchTrigger$.pipe(
    switchMap(filters =>
      this.brokerSvc.search(filters).pipe(
        map((results): SearchState => ({ results, loading: false, error: false, searched: true })),
        catchError((): Observable<SearchState> =>
          of({ results: [], loading: false, error: true, searched: true })),
        startWith({ results: [], loading: true, error: false, searched: false } as SearchState),
      ),
    ),
    startWith({ results: [], loading: true, error: false, searched: false } as SearchState),
  );

  ngOnInit(): void {
    if (this.data.initialQuery) {
      this.form.patchValue({ legalName: this.data.initialQuery });
    }
    this.onSearch();
  }

  setPartyType(type: BrokerPartyType): void {
    if (this.partyType() === type) return;
    this.partyType.set(type);
    this.form.patchValue({ legalName: '', firstName: '', lastName: '' });
    this.selectedId.set(null);
    this.onSearch();
  }

  onSearch(): void {
    const v = this.form.getRawValue() as BrokerSearchFilters;
    this.selectedId.set(null);
    this.searchTrigger$.next({ ...v, partyType: this.partyType() });
  }

  onReset(): void {
    this.form.reset({ role: 'Broker' });
    this.selectedId.set(null);
  }

  selectRow(id: string): void {
    this.selectedId.set(id);
  }

  isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  onCancel(): void { this.modalRef.close(null); }

  onAddSelected(results: Broker[]): void {
    const id = this.selectedId();
    if (!id) return;
    const picked = results.find(b => b.brokerId === id) ?? null;
    this.modalRef.close(picked);
  }
}
