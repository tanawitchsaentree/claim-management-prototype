import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { NxLinkModule } from '@allianz/ng-aquila/link';
import { FnolStepperComponent, FnolStep } from '../components/fnol-stepper/fnol-stepper.component';
import { DevHelperBannerComponent } from '../components/dev-helper-banner/dev-helper-banner.component';
import { FnolStateService } from '../services/fnol-state.service';
import { StepConfig } from '../models/fnol-form.model';
import { Policy } from '../../../core/models';

@Component({
  selector: 'app-fnol-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, NxIconModule, NxButtonModule, NxPopoverModule, NxLinkModule, FnolStepperComponent, DevHelperBannerComponent],
  templateUrl: './fnol-shell.component.html',
  styleUrl: './fnol-shell.component.scss',
})
export class FnolShellComponent {
  private router     = inject(Router);
  private fnolState  = inject(FnolStateService);

  get policyContext(): Policy | null {
    return this.fnolState.selectedPolicyFull;
  }

  private readonly url$: Observable<string> = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
    shareReplay(1),
  );

  readonly showStepper$: Observable<boolean> = this.url$.pipe(
    map(url => this.fnolState.isWizardRoute(url)),
  );

  readonly steps$: Observable<FnolStep[]> = this.url$.pipe(
    map(url => {
      const configs: StepConfig[] = this.fnolState.getStepsForPath('happy');
      const activeIndex = this.fnolState.getCurrentStepIndex(url, 'happy');
      return configs.map((s, i) => ({
        key:    s.key,
        label:  s.label,
        status: (i < activeIndex ? 'completed' : i === activeIndex ? 'active' : 'pending') as FnolStep['status'],
      }));
    }),
  );
}
