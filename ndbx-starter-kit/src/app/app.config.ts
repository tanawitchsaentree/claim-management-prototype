import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';
import { NxExpertModule } from '@allianz/ng-aquila/config';
import { NxIsoDateModule } from '@allianz/ng-aquila/iso-date-adapter';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),

    // NDBX expert theme — applies dense/expert styling globally.
    // WARNING: overrides --interactive-primary and --text-02 at runtime.
    // Both are re-asserted in styles.scss :root — do not remove those overrides.
    NxExpertModule,

    // ISO date adapter — makes nx-datepicker return "YYYY-MM-DD" strings.
    // Do NOT import NxIsoDateModule again in individual components.
    NxIsoDateModule,
  ],
};
