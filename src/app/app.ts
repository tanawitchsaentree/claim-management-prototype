import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClaimDevBannerComponent } from './features/claims/dev-banner/claim-dev-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ClaimDevBannerComponent],
  template: `
    <app-claim-dev-banner />
    <router-outlet />
  `,
})
export class App {}
