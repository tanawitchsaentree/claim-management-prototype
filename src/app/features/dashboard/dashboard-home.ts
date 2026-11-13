import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../../core/services/auth';
import { Dashboard } from './dashboard';
import { ManagerDashboardComponent } from './manager/manager-dashboard.component';

// BMPCC-22395 Scenario 1 + AC5: a Claims Manager lands on their own
// dashboard without navigating; everyone else gets the handler dashboard,
// whose files are untouched by this story.
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [Dashboard, ManagerDashboardComponent],
  template: `
    @if (auth.isClaimsManager()) {
      <app-manager-dashboard />
    } @else {
      <app-dashboard />
    }
  `,
  changeDetection: ChangeDetectionStrategy.Eager
})
export class DashboardHomeComponent {
  readonly auth = inject(AuthService);
}
