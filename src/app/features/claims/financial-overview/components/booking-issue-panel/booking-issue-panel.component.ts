import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookingIssue } from '../../../../../core/models/gg-booking.model';

/** Plain-language explanation under a "Needs fixing" row: why, and who acts. */
@Component({
  selector: 'app-booking-issue-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './booking-issue-panel.component.html',
  styleUrl: './booking-issue-panel.component.scss'
})
export class BookingIssuePanelComponent {
  readonly issue = input.required<BookingIssue>();
}
