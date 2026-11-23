import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ClaimDevBannerComponent } from './features/claims/dev-banner/claim-dev-banner.component';
import { ClaimDevHelperService } from './features/claims/dev-banner/claim-dev-helper.service';
import { PersonaSwitcherComponent } from './features/dashboard/widgets/persona-switcher';
import { DevHelperBannerComponent } from './features/fnol/components/dev-helper-banner/dev-helper-banner.component';
import { AccessGateComponent } from './features/access-gate/access-gate.component';
import { ToastStackComponent } from './shared/components/toast/toast-stack.component';
import { TourStepRendererComponent } from './shared/components/tour/tour-step-renderer.component';
import { PrototypeEntryService } from './core/services/prototype-entry.service';
import { TourService } from './core/services/tour.service';
import { ArrivalPanelComponent } from './shared/components/arrival-panel/arrival-panel.component';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    ClaimDevBannerComponent,
    DevHelperBannerComponent,
    PersonaSwitcherComponent,
    AccessGateComponent,
    ToastStackComponent,
    TourStepRendererComponent,
    ArrivalPanelComponent,
    NxMessageModule
  ],
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (isExploration) {
      <nx-message context="warning" class="exploration-banner"
        >EXPLORATION BUILD: work in progress, not final</nx-message
      >
    }
    @if (unlocked()) {
      <div class="dev-banner-row">
        @if (devBannerMode !== 'off') {
          <app-claim-dev-banner />
        }
        <!-- View as lives in the DEV banner menu, which only the 'full' build
             has. The deployed link (banner off) still needs to switch user on
             the dashboard, so the Persona strip comes back there. -->
        @if (devBannerMode !== 'full' && currentRoute() === '/dashboard') {
          <app-persona-switcher />
        }
        @if (helper.shouldShowFnolHelper() && devBannerMode === 'full') {
          <app-dev-helper-banner />
        }
      </div>
      <router-outlet />
      <app-toast-stack />
      <app-tour-step-renderer />
      @if (arrival(); as arrivalContext) {
        <app-arrival-panel
          [context]="arrivalContext"
          [tourActive]="tour.active()"
          [currentRoute]="currentRoute()"
          (startTour)="onStartArrivalTour()"
          (endTour)="tour.end()"
          (dismissed)="prototypeEntry.dismiss()"
        />
      }
    } @else {
      <app-access-gate (unlocked)="onUnlocked()" />
    }
  `
})
export class App implements OnInit {
  readonly helper = inject(ClaimDevHelperService);
  private readonly router = inject(Router);
  readonly prototypeEntry = inject(PrototypeEntryService);
  readonly tour = inject(TourService);
  // Orientation for a tab opened from a tracker link — null in every other tab,
  // so the panel simply doesn't exist unless the URL asked for it.
  readonly arrival = this.prototypeEntry.arrival;
  readonly unlocked = signal(false);
  readonly isExploration = environment.buildTag === 'exploration';
  readonly devBannerMode = environment.devBannerMode;

  // Path only — the arrival panel states where the reviewer is, and repeating the
  // ?pt=/?tk= entry params back at them is noise.
  readonly currentRoute = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map((e): string | null => (e as NavigationEnd).urlAfterRedirects.split('?')[0])
    ),
    { initialValue: null }
  );

  ngOnInit(): void {
    if (localStorage.getItem('app:access-granted') === '1') {
      this.unlocked.set(true);
      void this.prototypeEntry.runEntryTour();
    }
  }

  onStartArrivalTour(): void {
    void this.prototypeEntry.startTour();
  }

  onUnlocked(): void {
    this.unlocked.set(true);
    // Second half of the ?pt= entry, deliberately here and not in the app
    // initializer: the tour it starts renders through <app-tour-step-renderer />,
    // which only exists inside the @if (unlocked()) block above. Runs once —
    // PrototypeEntryService guards against a repeat.
    void this.prototypeEntry.runEntryTour();
  }
}
