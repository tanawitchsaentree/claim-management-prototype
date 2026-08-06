import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
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
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import {
  Party, PartyFilters, PartyRole, ClearanceStatus, IdType,
  PARTY_ROLE_LABELS, CLEARANCE_STATUS_LABELS, ID_TYPE_LABELS,
} from '../../../../core/models/party.model';

export interface AddPartyModalData {
  policyNumber: string;
  existingPartyIds: Set<string>;
  targetClaimId: string;
  targetSectionId?: string;
}

interface SearchState {
  results: Party[];
  loading: boolean;
  error: boolean;
  searched: boolean;
}

@Component({
  selector: 'app-add-party-modal',
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
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './add-party-modal.component.html',
  styleUrl: './add-party-modal.component.scss',
})
export class AddPartyModalComponent {
  readonly data = inject<AddPartyModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddPartyModalComponent, Party[]>>(NxModalRef);
  private readonly partiesSvc = inject(MockPartiesService);

  readonly filterForm = new FormGroup({
    legalName:       new FormControl(''),
    partyRole:       new FormControl<string | null>(null),
    country:         new FormControl<string | null>(null),
    city:            new FormControl(''),
    postalCode:      new FormControl(''),
    street:          new FormControl(''),
    partyId:         new FormControl(''),
    email:           new FormControl(''),
    phone:           new FormControl(''),
    idType:          new FormControl<string | null>(null),
    idNumber:        new FormControl(''),
    lineOfBusiness:  new FormControl<string | null>(null),
    operatingEntity: new FormControl<string | null>(null),
    clearanceStatus: new FormControl<string | null>(null),
  });

  readonly partyRoleKeys   = Object.keys(PARTY_ROLE_LABELS) as PartyRole[];
  readonly partyRoleLabels = PARTY_ROLE_LABELS;
  readonly clearanceKeys   = Object.keys(CLEARANCE_STATUS_LABELS) as ClearanceStatus[];
  readonly clearanceLabels = CLEARANCE_STATUS_LABELS;
  readonly idTypeKeys      = Object.keys(ID_TYPE_LABELS) as IdType[];
  readonly idTypeLabels    = ID_TYPE_LABELS;

  readonly countryOptions = [
    { value: 'DE', label: 'Germany' },    { value: 'AT', label: 'Austria' },
    { value: 'CH', label: 'Switzerland' },{ value: 'FR', label: 'France' },
    { value: 'IT', label: 'Italy' },      { value: 'ES', label: 'Spain' },
    { value: 'NL', label: 'Netherlands' },{ value: 'GB', label: 'United Kingdom' },
    { value: 'US', label: 'United States' },
  ];

  readonly lobOptions = [
    { value: 'Property',    label: 'Property' },
    { value: 'Liability',   label: 'Liability' },
    { value: 'Marine',      label: 'Marine' },
    { value: 'Cyber',       label: 'Cyber' },
    { value: 'Engineering', label: 'Engineering' },
  ];

  readonly oeOptions = [
    { value: 'Allianz Commercial Germany', label: 'Allianz Commercial Germany' },
    { value: 'Allianz Commercial UK',      label: 'Allianz Commercial UK' },
    { value: 'Allianz Commercial France',  label: 'Allianz Commercial France' },
  ];

  readonly selectedIds = new Set<string>();

  private readonly searchTrigger$ = new Subject<Partial<PartyFilters>>();

  readonly state$: Observable<SearchState> = this.searchTrigger$.pipe(
    switchMap(filters =>
      this.partiesSvc.searchAll(filters).pipe(
        map((results): SearchState => ({
          results: results.filter(p => !this.data.existingPartyIds.has(p.partyId)),
          loading: false,
          error: false,
          searched: true,
        })),
        catchError((): Observable<SearchState> =>
          of({ results: [], loading: false, error: true, searched: true }),
        ),
      ),
    ),
  );

  get filledCount(): number {
    return Object.values(this.filterForm.value as Record<string, unknown>)
      .filter(v => v != null && String(v).trim() !== '').length;
  }

  get canSearch(): boolean {
    return this.filledCount >= 2;
  }

  onSearch(): void {
    if (!this.canSearch) return;
    this.selectedIds.clear();
    const raw = this.filterForm.value;
    const filters = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== ''),
    ) as Partial<PartyFilters>;
    this.searchTrigger$.next(filters);
  }

  onReset(): void {
    this.filterForm.reset();
    this.selectedIds.clear();
  }

  toggleRow(partyId: string): void {
    if (this.selectedIds.has(partyId)) {
      this.selectedIds.delete(partyId);
    } else {
      this.selectedIds.add(partyId);
    }
  }

  isSelected(partyId: string): boolean {
    return this.selectedIds.has(partyId);
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  rolesDisplay(party: Party): string {
    return party.roles.map(r => PARTY_ROLE_LABELS[r]).join(', ');
  }

  onCancel(): void {
    this.modalRef.close([]);
  }

  onAdd(results: Party[]): void {
    const selected = results.filter(r => this.selectedIds.has(r.partyId));
    this.modalRef.close(selected);
  }
}
