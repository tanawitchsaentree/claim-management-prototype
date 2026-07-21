import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { PolicyLocation } from '../../../core/models';

export interface PolicyLocationSearchModalData {
  policyNumber: string;
  policyLocations: PolicyLocation[];
}

export type PolicyLocationSearchModalResult =
  | { kind: 'picked'; locations: PolicyLocation[] }
  | { kind: 'fallback-manual'; seedQuery?: string }
  | null;

@Component({
  selector: 'app-policy-location-search-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxInputModule,
    NxButtonModule,
    NxIconModule,
    NxRadioModule,
    NxMessageModule,
    NxTableModule,
  ],
  templateUrl: './policy-location-search-modal.component.html',
  styleUrl: './policy-location-search-modal.component.scss',
})
export class PolicyLocationSearchModalComponent implements OnInit {
  readonly data     = inject<PolicyLocationSearchModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<PolicyLocationSearchModalComponent, PolicyLocationSearchModalResult>>(NxModalRef);

  readonly searchForm = new FormGroup({
    name: new FormControl(''),
    id:   new FormControl(''),
    city: new FormControl(''),
  });

  readonly filtered     = signal<PolicyLocation[]>([]);
  readonly selectedId   = signal<string | null>(null);
  readonly hasSelection = computed(() => this.selectedId() !== null);

  ngOnInit(): void {
    this.filtered.set(this.data.policyLocations);
  }

  onSearch(): void {
    const { name, id, city } = this.searchForm.value;
    this.filtered.set(
      this.data.policyLocations.filter(l => {
        if (name && !l.name.toLowerCase().includes(name.toLowerCase()))      return false;
        if (id   && !l.propertyId?.toLowerCase().includes(id.toLowerCase())) return false;
        if (city && !l.city.toLowerCase().includes(city.toLowerCase()))      return false;
        return true;
      }),
    );
  }

  onReset(): void {
    this.searchForm.reset();
    this.filtered.set(this.data.policyLocations);
  }

  isSelected(id: string): boolean { return this.selectedId() === id; }

  selectRow(id: string): void {
    this.selectedId.set(id);
  }

  onCancel(): void { this.modalRef.close(null); }

  onAddManually(): void {
    const seed = this.searchForm.value.name?.trim() || undefined;
    this.modalRef.close({ kind: 'fallback-manual', seedQuery: seed });
  }

  onConfirm(): void {
    const id = this.selectedId();
    if (!id) return;
    const location = this.data.policyLocations.find(l => l.id === id);
    if (!location) return;
    this.modalRef.close({ kind: 'picked', locations: [location] });
  }
}
