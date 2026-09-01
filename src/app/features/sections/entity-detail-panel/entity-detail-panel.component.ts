import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { SectionEntity, ClaimSection } from '../../../core/models/section.model';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip.component';
import {
  AddDamagedItemModalComponent,
  AddDamagedItemModalData,
  AddDamagedItemModalResult,
} from '../add-damaged-item-modal/add-damaged-item-modal.component';
import {
  EditDamagedItemModalComponent,
  EditDamagedItemModalData,
  EditDamagedItemModalResult,
  DamagedItem,
} from '../edit-damaged-item-modal/edit-damaged-item-modal.component';
import { DamageTypeLabelPipe } from '../../../shared/pipes/damage-type-label.pipe';

const MOCK_ITEMS: Record<string, DamagedItem[]> = {
  'SE-001': [
    { name: 'Loading dock door', description: 'Broken opening/closing mechanism', damage: 'Material damage' },
    { name: 'Loading ramp',      description: 'Top layer is damaged.',            damage: 'Material damage' },
    { name: 'Window',            description: 'Broken window.',                   damage: 'Material damage' },
  ],
  'SE-002': [
    { name: 'Hydraulic system',  description: 'Hydraulic fluid leak detected.',   damage: 'Machinery breakdown' },
    { name: 'Mast assembly',     description: 'Bent mast, cannot lift.',          damage: 'Material damage' },
  ],
  'SE-003': [
    { name: 'Production line A', description: 'Conveyor belt damaged.',           damage: 'Business interruption' },
    {
      name: 'Lost contract margin', description: 'Q3 delivery contract cancelled by the buyer.',
      damage: 'Financial loss',
      financialLossCausedBy: 'Business Interruption',
      financialLossDetails: 'Contracted margin of 18% on EUR 340,000 of undelivered orders, per the signed schedule and the buyer’s cancellation notice.',
    },
  ],
};

@Component({
  selector: 'app-section-entity-detail',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxTooltipModule,
    NxContextMenuModule,
    NxModalModule,
    EmptyStateComponent,
    StatusChipComponent,
    DamageTypeLabelPipe,
  ],
  templateUrl: './entity-detail-panel.component.html',
  styleUrl: './entity-detail-panel.component.scss',
})
export class EntityDetailPanelComponent {
  @Input({ required: true }) entity!: SectionEntity;
  @Input({ required: true }) section!: ClaimSection;
  @Input() claimClosed = false;
  @Output() closed = new EventEmitter<void>();

  private readonly dialogSvc = inject(NxDialogService);
  private readonly toast     = inject(ToastService);

  readonly items = signal<DamagedItem[]>([]);

  ngOnInit(): void {
    this.items.set([...(MOCK_ITEMS[this.entity.id] ?? [])]);
  }

  async onAddItem(): Promise<void> {
    const ref = this.dialogSvc.open(AddDamagedItemModalComponent, {
      data: { entityName: this.entity.name } satisfies AddDamagedItemModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddDamagedItemModalResult | undefined;
    if (!result) return;
    this.items.update(list => [...list, result]);
    this.toast.success(`Item "${result.name}" added`);
  }

  async onEditItem(item: DamagedItem): Promise<void> {
    const ref = this.dialogSvc.open(EditDamagedItemModalComponent, {
      data: { item } satisfies EditDamagedItemModalData,
      width: '480px',
      maxWidth: '92vw',
    });
    const result = await firstValueFrom(ref.afterClosed()) as EditDamagedItemModalResult | undefined;
    if (!result) return;
    this.items.update(list => list.map(i => i === item ? result : i));
    this.toast.success(`Item "${result.name}" updated`);
  }

  async onDeleteItem(item: DamagedItem): Promise<void> {
    const ref = this.dialogSvc.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete damaged item',
        message: `Remove "${item.name}" from this entity? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmDanger: true,
      } satisfies ConfirmDialogData,
      width: '400px',
      maxWidth: '92vw',
    });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    this.items.update(list => list.filter(i => i !== item));
    this.toast.success(`Item "${item.name}" removed`);
  }
}
