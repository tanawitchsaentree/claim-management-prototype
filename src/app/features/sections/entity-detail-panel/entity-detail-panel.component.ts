import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';

import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { SectionEntity, ClaimSection } from '../../../core/models/section.model';
import { ToastService } from '../../../shared/components/toast/toast.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import {
  AddDamagedItemModalComponent,
  AddDamagedItemModalData,
  AddDamagedItemModalResult
} from '../add-damaged-item-modal/add-damaged-item-modal.component';
import {
  EditDamagedItemModalComponent,
  EditDamagedItemModalData,
  EditDamagedItemModalResult
} from '../edit-damaged-item-modal/edit-damaged-item-modal.component';
import { DamagedItem } from '../damaged-item.config';
import { DamageTypeLabelPipe } from '../../../shared/pipes/damage-type-label.pipe';
import { CbiCaseTypeLabelPipe } from '../../../shared/pipes/cbi-case-type-label.pipe';
import { MockLookupService } from '../../../core/mock/services/mock-lookup.service';

// `causedBy` is set on every item, not just the financial-loss one — the field
// stopped being financial-loss-only on 2026-09-03 (see damaged-item.config.ts),
// and a seeded row with the column blank would read as "this cannot be recorded"
// rather than "nobody filled it in".
const MOCK_ITEMS: Record<string, DamagedItem[]> = {
  'SE-001': [
    {
      name: 'Loading dock door',
      description: 'Broken opening/closing mechanism',
      damage: 'Material damage',
      causedBy: 'Fire'
    },
    {
      name: 'Loading ramp',
      description: 'Top layer is damaged.',
      damage: 'Material damage',
      causedBy: 'Fire'
    },
    {
      name: 'Window',
      description: 'Broken window.',
      damage: 'Material damage',
      causedBy: 'Explosion'
    }
  ],
  'SE-002': [
    {
      name: 'Hydraulic system',
      description: 'Hydraulic fluid leak detected.',
      damage: 'Machinery breakdown',
      causedBy: 'Machinery breakdown'
    },
    {
      name: 'Mast assembly',
      description: 'Bent mast, cannot lift.',
      damage: 'Material damage',
      causedBy: 'Impact'
    }
  ],
  'SE-003': [
    {
      name: 'Production line A',
      description: 'Conveyor belt damaged.',
      damage: 'Business interruption',
      causedBy: 'Fire'
    },
    {
      name: 'Lost contract margin',
      description: 'Q3 delivery contract cancelled by the buyer.',
      damage: 'Financial loss',
      causedBy: 'Business Interruption',
      financialLossDetails:
        'Contracted margin of 18% on EUR 340,000 of undelivered orders, per the signed schedule and the buyer’s cancellation notice.'
    },
    {
      name: 'Warehouse operative injury',
      description: 'Burns to the left forearm while clearing the line.',
      damage: 'Bodily injury',
      causedBy: 'Fire',
      injuredPartyName: 'Jonas Weber',
      injuredPartyCountry: 'Germany',
      injuredPartyRole: 'Third party'
    }
  ]
};

@Component({
  selector: 'app-section-entity-detail',
  standalone: true,
  imports: [
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxTooltipModule,
    NxContextMenuModule,
    NxModalModule,
    EmptyStateComponent,
    StatusChipComponent,
    DamageTypeLabelPipe,
    CbiCaseTypeLabelPipe
  ],
  templateUrl: './entity-detail-panel.component.html',
  styleUrl: './entity-detail-panel.component.scss'
})
export class EntityDetailPanelComponent implements OnInit {
  @Input({ required: true }) entity!: SectionEntity;
  @Input({ required: true }) section!: ClaimSection;
  @Input() claimClosed = false;
  @Output() closed = new EventEmitter<void>();

  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast = inject(ToastService);
  private readonly lookupSvc = inject(MockLookupService);

  readonly items = signal<DamagedItem[]>([]);

  // Built but held back on purpose (2026-09-17) — CBI (BMPCC-17927) is still
  // "Draft A v2", not signed off. Open Points #1 (validate insured has own PD
  // cover) and #4 (which of the 12 case types are approved for baseline) are
  // still open with Sarah/UW. Flip to true only when told to turn it on —
  // until then the capture at FNOL keeps writing this data, it just doesn't
  // surface here yet.
  readonly showCbiLocation = false;

  ngOnInit(): void {
    this.items.set([...(MOCK_ITEMS[this.entity.id] ?? [])]);
  }

  cbiLocationLine(): string {
    const loc = this.entity.cbiOriginatingLocation;
    if (!loc) return '–';
    const countryLabel =
      this.lookupSvc.getCountriesSync().find(o => o.value === loc.country)?.label ?? loc.country;
    const streetPart = [loc.street, loc.houseNumber].filter(Boolean).join(' ');
    const line1 = [streetPart, loc.zip, loc.city].filter(Boolean).join(', ');
    const line2 = [loc.state, countryLabel].filter(Boolean).join(', ');
    return [line1, line2].filter(Boolean).join(' — ') || '–';
  }

  async onAddItem(): Promise<void> {
    const ref = this.dialogSvc.open(AddDamagedItemModalComponent, {
      data: { entityName: this.entity.name } satisfies AddDamagedItemModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | AddDamagedItemModalResult
      | undefined;
    if (!result) return;
    this.items.update(list => [...list, result]);
    this.toast.success(`Item "${result.name}" added`);
  }

  async onEditItem(item: DamagedItem): Promise<void> {
    const ref = this.dialogSvc.open(EditDamagedItemModalComponent, {
      data: { item } satisfies EditDamagedItemModalData,
      width: '480px',
      maxWidth: '92vw'
    });
    const result = (await firstValueFrom(ref.afterClosed())) as
      | EditDamagedItemModalResult
      | undefined;
    if (!result) return;
    this.items.update(list => list.map(i => (i === item ? result : i)));
    this.toast.success(`Item "${result.name}" updated`);
  }

  async onDeleteItem(item: DamagedItem): Promise<void> {
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete damaged item',
        message: `Remove "${item.name}" from this entity? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmDanger: true
      } satisfies ConfirmDialogData,
      width: '400px',
      maxWidth: '92vw'
    });
    const confirmed = (await firstValueFrom(ref.afterClosed())) as boolean | undefined;
    if (!confirmed) return;
    this.items.update(list => list.filter(i => i !== item));
    this.toast.success(`Item "${item.name}" removed`);
  }
}
