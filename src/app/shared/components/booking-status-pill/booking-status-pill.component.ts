import { Component, computed, input } from '@angular/core';
import { BookingStatus, displayStatus, StatusTone } from '../../../core/models/gg-booking.model';
import { StatusChipComponent } from '../status-chip/status-chip.component';

// Reuses the claim-status chip colours so no new tokens are needed:
// needs action = orange, waiting = blue, done = green, stopped (Rejected) = red.
// Grey read as "inactive" in the usability review.
const CHIP_FOR_TONE: Record<StatusTone, string> = {
  action: 'reopened',
  waiting: 'in-progress',
  done: 'bound',
  stopped: 'declined'
};

@Component({
  selector: 'app-booking-status-pill',
  standalone: true,
  imports: [StatusChipComponent],
  templateUrl: './booking-status-pill.component.html'
})
export class BookingStatusPillComponent {
  /** Approval status of the payment / reserve / recovery (Draft, Pending, Approved, ...). */
  readonly approvalStatus = input.required<string>();
  readonly booking = input<BookingStatus | undefined>(undefined);

  readonly shown = computed(() => displayStatus(this.approvalStatus(), this.booking()));
  readonly chip = computed(() => CHIP_FOR_TONE[this.shown().tone]);
}
