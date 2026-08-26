import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import { AppDatePipe } from '../../../../../shared/pipes/app-date.pipe';
import { ClaimActivity } from '../../../../../core/models/claim-overview.model';

@Component({
  selector: 'app-recent-activities-card',
  standalone: true,
  imports: [NxIconModule, NxTableModule, EmptyStateComponent, AppDatePipe],
  templateUrl: './recent-activities-card.component.html',
  styleUrl: './recent-activities-card.component.scss',
})
export class RecentActivitiesCardComponent {
  @Input({ required: true }) activities: ClaimActivity[] = [];
  @Input() expanded = false;
  @Output() toggled = new EventEmitter<void>();
}
