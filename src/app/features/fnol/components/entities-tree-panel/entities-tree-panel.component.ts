import { Component, computed, input, output } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { EntityRow, SubItem } from '../../../../core/models';
import {
  TreeGroup,
  hasAnySelection,
  isChecked,
  isIndeterminate
} from '../../../../shared/components/entities-selection/entity-tree';

/**
 * The narrow list on the left while one entity's details are open. Same
 * ticking as the full table, plus the entity being looked at is highlighted;
 * pick another name to open its details without going back to the table.
 */
@Component({
  selector: 'app-entities-tree-panel',
  standalone: true,
  imports: [NxIconModule, NxButtonModule, NxCheckboxModule, NxSwitcherModule, NxContextMenuModule],
  templateUrl: './entities-tree-panel.component.html',
  styleUrl: './entities-tree-panel.component.scss'
})
export class EntitiesTreePanelComponent {
  readonly groups = input.required<TreeGroup[]>();
  readonly activeId = input<string | null>(null);
  readonly selectedOnly = input(false);
  readonly allExpanded = computed(() => this.groups().every(g => g.expanded));

  readonly selectedOnlyChange = output<boolean>();
  readonly toggleAll = output<boolean>();
  readonly toggleGroup = output<TreeGroup>();
  readonly toggleRule = output<EntityRow>();
  readonly open = output<EntityRow>();
  readonly entityToggle = output<{ entity: EntityRow; checked: boolean }>();
  readonly subItemToggle = output<{ entity: EntityRow; sub: SubItem; checked: boolean }>();

  readonly hasAnySelection = hasAnySelection;
  readonly isChecked = isChecked;
  readonly isIndeterminate = isIndeterminate;
}
