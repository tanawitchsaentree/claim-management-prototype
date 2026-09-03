import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LossEventGeneralInfo } from '../../../core/models/loss-event-overview.model';

/**
 * General information card on the Loss Event Overview — the counterpart of the
 * production `app-general-info` in the claims-management-loss-overview MFE.
 * Split out of loss-event-overview.component.html purely to keep that template
 * inside the 200-line limit; it has no state of its own.
 */
@Component({
  selector: 'app-loss-event-general-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loss-event-general-info.component.html',
  styleUrl: './loss-event-general-info.component.scss',
})
export class LossEventGeneralInfoComponent {
  @Input({ required: true }) info!: LossEventGeneralInfo;
  /** Comes from LossEventSummary.eventDate — not duplicated in the general-info block. */
  @Input({ required: true }) eventDate!: string;
}
