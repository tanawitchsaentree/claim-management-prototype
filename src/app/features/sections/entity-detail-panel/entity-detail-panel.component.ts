import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { SectionEntity, ClaimSection } from '../../../core/models/section.model';

interface DamagedItem {
  name: string;
  description: string;
  damage: string;
}

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
  ],
};

@Component({
  selector: 'app-section-entity-detail',
  standalone: true,
  imports: [CommonModule, NxButtonModule, NxIconModule, NxTableModule, NxTooltipModule, NxContextMenuModule],
  templateUrl: './entity-detail-panel.component.html',
  styleUrl: './entity-detail-panel.component.scss',
})
export class EntityDetailPanelComponent {
  @Input({ required: true }) entity!: SectionEntity;
  @Input({ required: true }) section!: ClaimSection;
  @Output() closed = new EventEmitter<void>();

  get items(): DamagedItem[] {
    return MOCK_ITEMS[this.entity.id] ?? [];
  }
}
