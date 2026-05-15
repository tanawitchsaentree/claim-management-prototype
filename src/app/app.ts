import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClaimDevBannerComponent } from './features/claims/dev-banner/claim-dev-banner.component';
import { AccessGateComponent } from './features/access-gate/access-gate.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ClaimDevBannerComponent, AccessGateComponent],
  template: `
    @if (unlocked()) {
      <app-claim-dev-banner />
      <router-outlet />
    } @else {
      <app-access-gate (unlocked)="onUnlocked()" />
    }
  `,
})
export class App implements OnInit {
  readonly unlocked = signal(false);

  ngOnInit(): void {
    if (localStorage.getItem('app:access-granted') === '1') {
      this.unlocked.set(true);
    }
  }

  onUnlocked(): void {
    this.unlocked.set(true);
  }
}
