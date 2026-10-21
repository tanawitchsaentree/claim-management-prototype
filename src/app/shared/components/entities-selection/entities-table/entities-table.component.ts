import { Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { ENTITY_TYPE_LABELS, EntityRow, EntityType, SubItem } from '../../../../core/models';
import { EntityEventsInfoComponent } from '../entity-events-info/entity-events-info.component';
import { EntityLimitCellComponent } from '../entity-limit-cell/entity-limit-cell.component';
import { StatusChipComponent } from '../../status-chip/status-chip.component';
import {
  TreeGroup,
  hasAnySelection,
  isChecked,
  isIndeterminate
} from '../entity-tree';

const ENTITY_TYPES: EntityType[] = [
  'building',
  'vehicle',
  'marine',
  'employee',
  'financial',
  'other'
];

/**
 * The Entities & Damages list: one table, one row per damage type, entities
 * (and policy rules with the entities added under them) beneath. The cover of
 * each entity is the Status chip; there are no separate Promised / Not promised
 * blocks. Every change is reported to the step, which owns the data.
 */
@Component({
  selector: 'app-entities-table',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    NxIconModule,
    NxButtonModule,
    NxTableModule,
    NxCheckboxModule,
    NxContextMenuModule,
    StatusChipComponent,
    EntityLimitCellComponent,
    EntityEventsInfoComponent
  ],
  templateUrl: './entities-table.component.html',
  styleUrl: './entities-table.component.scss'
})
export class EntitiesTableComponent {
  readonly groups = input.required<TreeGroup[]>();
  readonly hasLossLocation = input(false);
  /** Ticking only: no per-row action menus (the Link policy coverage step). */
  readonly selectionOnly = input(false);
  readonly allExpanded = computed(() => this.groups().every(g => g.expanded));

  readonly toggleAll = output<boolean>();
  readonly toggleGroup = output<TreeGroup>();
  readonly toggleRule = output<EntityRow>();
  readonly entityToggle = output<{ entity: EntityRow; checked: boolean }>();
  readonly subItemToggle = output<{ entity: EntityRow; sub: SubItem; checked: boolean }>();
  readonly viewDetails = output<EntityRow>();
  readonly move = output<EntityRow>();
  readonly remove = output<EntityRow>();
  readonly addEntity = output<{ type: EntityType; rule?: EntityRow }>();

  readonly entityTypes = ENTITY_TYPES;
  readonly typeLabels = ENTITY_TYPE_LABELS;

  readonly hasAnySelection = hasAnySelection;
  readonly isChecked = isChecked;
  readonly isIndeterminate = isIndeterminate;

  ruleLabel(rule: EntityRow): string {
    return ENTITY_TYPE_LABELS[rule.ruleEntityType ?? 'other'];
  }

  addUnderRule(rule: EntityRow): void {
    this.addEntity.emit({ type: rule.ruleEntityType ?? 'other', rule });
  }
}
