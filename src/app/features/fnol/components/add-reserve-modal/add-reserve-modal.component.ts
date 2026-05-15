import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NxModalModule, NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { combineLatest, firstValueFrom } from 'rxjs';
import { MockPartiesService } from '../../../../core/mock/services/mock-parties.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { LookupOption } from '../../../../core/models/lookup.model';
import { ReserveType } from '../../../../core/models/reserve.model';
import { DamageGroup } from '../../../../core/models/entity-damage.model';
import { Party } from '../../../../core/models/party.model';

export interface AddReserveModalData {
  policyNumber: string;
  prefill?: import('../../../../core/models/reserve.model').Reserve;
}

export interface AddReserveResult {
  partyId: string;
  partyName: string;
  damageTypeKey: string;
  damageType: string;
  reserveType: ReserveType;
  damagedItemId?: string;
  currency: string;
  amount: number;
}

interface DamageOption {
  key: string;
  label: string;
  entities: { entityId: string; name: string }[];
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

  private readonly partiesSvc  = inject(MockPartiesService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly lookupSvc   = inject(MockLookupService);
  private readonly fb          = inject(FormBuilder);

  parties: Party[] = [];
  damageOptions: DamageOption[] = [];
  reserveTypeOptions: LookupOption[] = [];

  readonly form = this.fb.group({
    partyId:       ['', Validators.required],
    damageTypeKey: ['', Validators.required],
    reserveType:   ['', Validators.required],
    itemLevel:     [false],
    damagedItemId: [''],
  });

  get itemLevel(): boolean { return !!this.form.get('itemLevel')?.value; }

  get selectedDamageGroup(): DamageOption | undefined {
    return this.damageOptions.find(d => d.key === this.form.get('damageTypeKey')?.value);
  }

  get canAdd(): boolean {
    const v = this.form.value;
    if (!v.partyId || !v.damageTypeKey || !v.reserveType) return false;
    if (v.itemLevel && !v.damagedItemId) return false;
    return true;
  }

  async ngOnInit(): Promise<void> {
    const [parties, entitiesData, reserveTypes] = await firstValueFrom(
      combineLatest([
        this.partiesSvc.getPartiesForPolicy(this.data.policyNumber),
        this.entitiesSvc.getByPolicyId(this.data.policyNumber),
        this.lookupSvc.getReserveTypes(),
      ]),
    );
    this.parties = parties;
    this.damageOptions = this.buildDamageOptions(
      entitiesData.sections.flatMap(s => s.damageGroups),
    );
    this.reserveTypeOptions = reserveTypes;

    if (this.data.prefill) {
      const p = this.data.prefill;
      this.form.patchValue({
        partyId:       p.partyId,
        damageTypeKey: p.damageTypeKey ?? '',
        reserveType:   p.reserveType ?? '',
      });
    }
  }

  onCancel(): void { this.modalRef.close(null); }

  async onAdd(): Promise<void> {
    if (!this.canAdd) { this.form.markAllAsTouched(); return; }

    const v           = this.form.value;
    const party       = this.parties.find(p => p.partyId === v.partyId)!;
    const damageGroup = this.damageOptions.find(d => d.key === v.damageTypeKey)!;

    this.modalRef.close({
      partyId:       party.partyId,
      partyName:     party.legalName,
      damageTypeKey: damageGroup.key,
      damageType:    damageGroup.label,
      reserveType:   v.reserveType as ReserveType,
      damagedItemId: v.itemLevel ? (v.damagedItemId ?? undefined) : undefined,
      currency:      'EUR',
      amount:        0,
    });
  }

  private buildDamageOptions(groups: DamageGroup[]): DamageOption[] {
    const seen = new Map<string, DamageOption>();
    for (const group of groups) {
      if (!seen.has(group.damageTypeKey)) {
        seen.set(group.damageTypeKey, {
          key:      group.damageTypeKey,
          label:    group.damageType,
          entities: group.entities.map(e => ({ entityId: e.entityId, name: e.name })),
        });
      }
    }
    return Array.from(seen.values());
  }
}
