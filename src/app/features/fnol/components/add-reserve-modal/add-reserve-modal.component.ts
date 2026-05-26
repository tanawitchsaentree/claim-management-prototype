import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormControl, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { firstValueFrom } from 'rxjs';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LookupOption } from '../../../../core/models/lookup.model';
import { Reserve, ReserveType } from '../../../../core/models/reserve.model';

export interface AddReserveModalData {
  policyNumber: string;
  // Existing sections (reserves) the user can pick from.
  sections:    Reserve[];
  // Optional: open the modal pre-filled for a specific section
  preselectSectionId?: string;
}

export interface AddReserveResult {
  reserveId:     string;          // selected section
  reserveType:   ReserveType;     // tab to add to
  itemLevel:     boolean;
  damagedItemId?: string;          // required when itemLevel = true
}

@Component({
  selector: 'app-add-reserve-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxModalModule,
    NxFormfieldModule,
    NxDropdownModule,
    NxCheckboxModule,
    NxButtonModule,
    NxIconModule,
  ],
  templateUrl: './add-reserve-modal.component.html',
  styleUrl: './add-reserve-modal.component.scss',
})
export class AddReserveModalComponent implements OnInit {
  readonly data     = inject<AddReserveModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<AddReserveModalComponent, AddReserveResult | null>>(NxModalRef);

  private readonly lookupSvc = inject(MockLookupService);
  private readonly fb        = inject(FormBuilder);

  reserveTypeOptions: LookupOption[] = [];

  readonly form = this.fb.group({
    reserveId:     new FormControl<string | null>(null, Validators.required),
    reserveType:   new FormControl<ReserveType | null>('indemnity' as ReserveType, Validators.required),
    itemLevel:     new FormControl<boolean>(false),
    damagedItemId: new FormControl<string | null>(null),
  });

  // Reactive helpers
  readonly selectedReserveId = signal<string | null>(null);
  readonly itemLevel = signal<boolean>(false);

  readonly selectedSection = computed<Reserve | null>(() => {
    const id = this.selectedReserveId();
    if (!id) return null;
    return this.data.sections.find(s => s.reserveId === id) ?? null;
  });

  readonly damagedItemOptions = computed(() => this.selectedSection()?.damagedItems ?? []);

  get canAdd(): boolean {
    const v = this.form.value;
    if (!v.reserveId || !v.reserveType) return false;
    if (v.itemLevel && !v.damagedItemId) return false;
    return true;
  }

  sectionLabel(r: Reserve): string {
    return `Section ${r.sectionNo}: ${r.partyName} — ${r.damageType}`;
  }

  async ngOnInit(): Promise<void> {
    this.reserveTypeOptions = await firstValueFrom(this.lookupSvc.getReserveTypes());

    // No subscribe — handle changes via template event handlers below.

    if (this.data.preselectSectionId) {
      this.form.patchValue({ reserveId: this.data.preselectSectionId });
    }
  }

  onSectionChange(id: string | null): void {
    this.selectedReserveId.set(id);
    this.form.patchValue({ reserveId: id, damagedItemId: null });
  }

  onItemLevelChange(checked: boolean): void {
    this.itemLevel.set(checked);
    this.form.patchValue({ itemLevel: checked });
    const ctrl = this.form.get('damagedItemId')!;
    if (checked) ctrl.setValidators(Validators.required);
    else { ctrl.clearValidators(); ctrl.setValue(null); }
    ctrl.updateValueAndValidity();
  }

  onCancel(): void { this.modalRef.close(null); }

  async onAdd(): Promise<void> {
    if (!this.canAdd) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    this.modalRef.close({
      reserveId:     v.reserveId!,
      reserveType:   v.reserveType as ReserveType,
      itemLevel:     !!v.itemLevel,
      damagedItemId: v.itemLevel ? (v.damagedItemId ?? undefined) : undefined,
    });
  }
}
