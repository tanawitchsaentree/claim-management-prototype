import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ClaimDevBannerComponent } from './features/claims/dev-banner/claim-dev-banner.component';
import { ClaimDevHelperService } from './features/claims/dev-banner/claim-dev-helper.service';
import { DevHelperBannerComponent } from './features/fnol/components/dev-helper-banner/dev-helper-banner.component';
import { AccessGateComponent } from './features/access-gate/access-gate.component';
import { ToastStackComponent } from './shared/components/toast/toast-stack.component';
import { TourStepRendererComponent } from './shared/components/tour/tour-step-renderer.component';
import { PersonaSwitcherComponent } from './features/dashboard/widgets/persona-switcher';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ClaimDevBannerComponent, DevHelperBannerComponent, AccessGateComponent, ToastStackComponent, TourStepRendererComponent, PersonaSwitcherComponent, NxMessageModule],
  styleUrl: './app.scss',
  template: `
    @if (isExploration) {
      <nx-message context="warning" class="exploration-banner">EXPLORATION BUILD — work in progress, not final</nx-message>
    }
    @if (unlocked()) {
      <div class="dev-banner-row">
        @if (devBannerMode !== 'off') {
          <app-claim-dev-banner />
        }
        @if (isDashboard()) {
          <app-persona-switcher />
        }
        @if (helper.shouldShowFnolHelper() && devBannerMode === 'full') {
          <app-dev-helper-banner />
        }
      </div>
      <router-outlet />
      <app-toast-stack />
      <app-tour-step-renderer />
    } @else {
      <app-access-gate (unlocked)="onUnlocked()" />
    }
  `,
})
export class App implements OnInit {
  readonly helper   = inject(ClaimDevHelperService);
  private readonly router = inject(Router);
  readonly unlocked = signal(false);
  readonly isExploration = environment.buildTag === 'exploration';
  readonly devBannerMode = environment.devBannerMode;

  readonly isDashboard = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects === '/dashboard')
    ),
    { initialValue: false }
  );

  ngOnInit(): void {
    if (localStorage.getItem('app:access-granted') === '1') {
      this.unlocked.set(true);
    }
  }

  onUnlocked(): void {
    this.unlocked.set(true);
  }
}
