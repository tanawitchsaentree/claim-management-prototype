import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component';
import { SubReserve } from '../../../../../../core/models/reserve.model';

export interface ReserveLineChange {
  id: string;
  patch: Partial<SubReserve>;
}

/**
 * One tab of the reserve editor: production shows a sub-type dropdown
 * ("Select") and an Amount field per tab (ReservesPage.ts
 * selectSubTypeAndEnterAmount). Several lines per tab are allowed, like the
 * prototype's earlier editor.
 */
@Component({
  selector: 'app-reserve-lines',
  standalone: true,
  imports: [
    NxButtonModule,
    NxIconModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    EmptyStateComponent
  ],
  templateUrl: './reserve-lines.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reserve-lines.component.scss'
})
export class ReserveLinesComponent {
  @Input({ required: true }) lines: SubReserve[] = [];
  @Input({ required: true }) subTypes: string[] = [];
  @Input({ required: true }) currency = 'EUR';
  @Input({ required: true }) typeLabel = '';
  @Input() showErrors = false;

  @Output() added = new EventEmitter<void>();
  @Output() removed = new EventEmitter<string>();
  @Output() changed = new EventEmitter<ReserveLineChange>();

  // A typed or pasted negative is clamped here; the input's min only stops the arrows.
  onAmount(id: string, raw: string): void {
    const n = +raw || 0;
    this.changed.emit({ id, patch: { amount: n < 0 ? 0 : n } });
  }

  missingSubType(line: SubReserve): boolean {
    return this.showErrors && line.amount > 0 && !line.subType;
  }
}
