import { Component, input } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { EntityRow, LocationLimit } from '../../../../core/models';

const LIMIT_CAP = 3;

/**
 * An entity's limit. With a location of loss and per-location limits it lists
 * them (first three, the rest behind "+N more"); otherwise it shows the single
 * policy limit with an (i) explaining where that figure comes from.
 */
@Component({
  selector: 'app-entity-limit-cell',
  standalone: true,
  imports: [NxIconModule, NxPopoverModule],
  templateUrl: './entity-limit-cell.component.html',
  styleUrl: './entity-limit-cell.component.scss'
})
export class EntityLimitCellComponent {
  readonly entity = input.required<EntityRow>();
  readonly hasLossLocation = input(false);

  showsList(): boolean {
    return this.hasLossLocation() && !!this.entity().limits?.length;
  }

  /** Only a plain amount ("50,000 EUR") gets the explanation; "80% of New price" is self-explanatory. */
  isAmount(): boolean {
    return /^[\d.,]+\s[A-Z]{3}$/.test(this.entity().limit);
  }

  visible(): LocationLimit[] {
    return this.entity().limits?.slice(0, LIMIT_CAP) ?? [];
  }

  hidden(): LocationLimit[] {
    return this.entity().limits?.slice(LIMIT_CAP) ?? [];
  }
}
