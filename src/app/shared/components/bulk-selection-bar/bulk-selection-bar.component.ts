import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NxButtonModule } from '@allianz/ng-aquila/button';

/**
 * The grey "N selected" bar above a table with selectable rows: count on the
 * left, Clear selection + the bulk actions (projected) on the right.
 * Extracted from Claims list's .cl-bulk-bar (BMPCC-22328 / 22660) so Section
 * overview gets the same bar, not a look-alike. Claims list can switch to it.
 */
@Component({
  selector: 'app-bulk-selection-bar',
  standalone: true,
  imports: [NxButtonModule],
  template: `
    <div class="bsb" role="region" [attr.aria-label]="'Selected ' + noun + 's'">
      <span class="bsb__count" aria-live="polite"
        >{{ count }} {{ noun }}{{ count === 1 ? '' : 's' }} selected</span
      >
      <div class="bsb__actions">
        <button nxButton="tertiary small" type="button" (click)="clear.emit()">
          Clear selection
        </button>
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bulk-selection-bar.component.scss'
})
export class BulkSelectionBarComponent {
  @Input({ required: true }) count = 0;
  @Input() noun = 'item';
  @Output() readonly clear = new EventEmitter<void>();
}
