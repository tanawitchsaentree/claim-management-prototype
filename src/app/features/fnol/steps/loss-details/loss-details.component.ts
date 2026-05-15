import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NxButtonModule } from '@allianz/ng-aquila/button';

@Component({
  selector: 'app-loss-details',
  standalone: true,
  imports: [NxButtonModule],
  template: `
    <div style="padding: 48px 32px">
      <h1>Loss Details (Skeleton Mode)</h1>
      <button nxButton="secondary" type="button" (click)="onBack()">Back</button>
    </div>
  `,
})
export class LossDetailsComponent {
  private router = inject(Router);

  onBack(): void {
    this.router.navigate(['/fnol/skeleton-create']);
  }
}
