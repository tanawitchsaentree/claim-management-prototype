import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { EntityRow, SubItem } from '../../../../../core/models';
import { StatusChipComponent } from '../../../../../shared/components/status-chip/status-chip.component';

@Component({
  selector: 'app-entity-row',
  standalone: true,
  imports: [
    CommonModule,
    NxTableModule,
    NxCheckboxModule,
    NxButtonModule,
    NxIconModule,
    NxTooltipModule,
    NxContextMenuModule,
    StatusChipComponent,
  ],
  templateUrl: './entity-row.component.html',
})
export class EntityRowComponent {
  @Input({ required: true }) entity!: EntityRow;
  @Input() showCoveredForEvents = false;
  @Output() entityToggle = new EventEmitter<{ entity: EntityRow; checked: boolean }>();
  @Output() subItemToggle = new EventEmitter<{ entity: EntityRow; subItem: SubItem; checked: boolean }>();

  isChecked(): boolean {
    if (!this.entity.subItems?.length) return this.entity.selected;
    return this.entity.subItems.every(s => s.selected);
  }

  isIndeterminate(): boolean {
    if (!this.entity.subItems?.length) return false;
    const n = this.entity.subItems.filter(s => s.selected).length;
    return n > 0 && n < this.entity.subItems.length;
  }

  onEntityChecked(checked: boolean): void {
    this.entityToggle.emit({ entity: this.entity, checked });
  }

  onSubItemChecked(subItem: SubItem, checked: boolean): void {
    this.subItemToggle.emit({ entity: this.entity, subItem, checked });
  }

  toggleExpand(): void {
    this.entity.expanded = !this.entity.expanded;
  }
}
