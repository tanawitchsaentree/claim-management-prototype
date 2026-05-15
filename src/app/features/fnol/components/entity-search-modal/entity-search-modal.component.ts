import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
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
import { Observable, Subject, switchMap, catchError, of, map } from 'rxjs';
import { MockEntitySearchService } from '../../../../core/mock/services/mock-entity-search.service';
import {
  EntitySearchResult,
  EntitySearchFilters,
  EntityType,
  ENTITY_TYPE_LABELS,
  COUNTRY_OPTIONS,
} from '../../../../core/models/entity-damage.model';

export interface EntitySearchModalData {
  policyNumber: string;
  entityType: EntityType;
}

interface SearchState {
  results: EntitySearchResult[];
  loading: boolean;
  error: boolean;
  searched: boolean;
}

@Component({
  selector: 'app-entity-search-modal',
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
  templateUrl: './entity-search-modal.component.html',
  styleUrl: './entity-search-modal.component.scss',
})
export class EntitySearchModalComponent implements OnInit {
  readonly data = inject<EntitySearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<EntitySearchModalComponent, EntitySearchResult[]>>(NxModalRef);
  private readonly fb = inject(FormBuilder);
  private readonly searchService = inject(MockEntitySearchService);

  readonly countries = COUNTRY_OPTIONS;

  title = '';

  readonly filterForm: FormGroup = this.fb.group({
    locationRuleNumber: [''],
    country:           [''],
    city:              [''],
    zipOrPostalCode:   [''],
    streetAndNumber:   [''],
    locationName:      [''],
  });

  readonly selectedIds = new Set<string>();

  private readonly searchTrigger$ = new Subject<EntitySearchFilters>();

  readonly state$: Observable<SearchState> = this.searchTrigger$.pipe(
    switchMap(filters =>
      this.searchService.search(this.data.policyNumber, this.data.entityType, filters).pipe(
        map((results): SearchState => ({ results, loading: false, error: false, searched: true })),
        catchError((): Observable<SearchState> =>
          of({ results: [], loading: false, error: true, searched: true }),
        ),
      ),
    ),
  );

  ngOnInit(): void {
    this.title = ENTITY_TYPE_LABELS[this.data.entityType];
  }

  get filledCount(): number {
    return Object.values(this.filterForm.value as Record<string, string>)
      .filter(v => v != null && String(v).trim() !== '').length;
  }

  get canSearch(): boolean {
    return this.filledCount >= 2;
  }

  onSearch(): void {
    if (!this.canSearch) return;
    this.selectedIds.clear();
    this.searchTrigger$.next(this.filterForm.value as EntitySearchFilters);
  }

  onReset(): void {
    this.filterForm.reset({
      locationRuleNumber: '',
      country:            '',
      city:               '',
      zipOrPostalCode:    '',
      streetAndNumber:    '',
      locationName:       '',
    });
    this.selectedIds.clear();
  }

  toggleRow(propertyId: string): void {
    if (this.selectedIds.has(propertyId)) {
      this.selectedIds.delete(propertyId);
    } else {
      this.selectedIds.add(propertyId);
    }
  }

  isSelected(propertyId: string): boolean {
    return this.selectedIds.has(propertyId);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  onCancel(): void {
    this.modalRef.close([]);
  }

  onAdd(results: EntitySearchResult[]): void {
    const selected = results.filter(r => this.selectedIds.has(r.propertyId));
    this.modalRef.close(selected);
  }
}
