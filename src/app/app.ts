import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClaimDevBannerComponent } from './features/claims/dev-banner/claim-dev-banner.component';
import { ClaimDevHelperService } from './features/claims/dev-banner/claim-dev-helper.service';
import { DevHelperBannerComponent } from './features/fnol/components/dev-helper-banner/dev-helper-banner.component';
import { AccessGateComponent } from './features/access-gate/access-gate.component';
import { ToastStackComponent } from './shared/components/toast/toast-stack.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ClaimDevBannerComponent, DevHelperBannerComponent, AccessGateComponent, ToastStackComponent],
  styleUrl: './app.scss',
  template: `
    @if (unlocked()) {
      <div class="dev-banner-row">
        <app-claim-dev-banner />
        @if (helper.shouldShowFnolHelper()) {
          <app-dev-helper-banner />
        }
      </div>
      <router-outlet />
      <app-toast-stack />
    } @else {
      <app-access-gate (unlocked)="onUnlocked()" />
    }
  `,
})
export class App implements OnInit {
  readonly helper = inject(ClaimDevHelperService);
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
