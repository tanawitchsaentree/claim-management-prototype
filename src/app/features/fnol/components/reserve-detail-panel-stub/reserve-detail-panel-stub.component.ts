import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { Reserve, RESERVE_TYPE_LABELS } from '../../../../core/models/reserve.model';

@Component({
  selector: 'app-reserve-detail-panel-stub',
  standalone: true,
  imports: [CommonModule, NxButtonModule, NxIconModule],
  templateUrl: './reserve-detail-panel-stub.component.html',
  styleUrl: './reserve-detail-panel-stub.component.scss',
})
export class ReserveDetailPanelStubComponent {
  @Input({ required: true }) reserve!: Reserve;
  @Output() closePanel = new EventEmitter<void>();

  readonly typeLabels = RESERVE_TYPE_LABELS;
}
