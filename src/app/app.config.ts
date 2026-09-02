import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, importProvidersFrom, inject, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding, withRouterConfig, withViewTransitions } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NxExpertModule } from '@allianz/ng-aquila/config';
import { NX_ICON_INITIALIZER, NxIconRegistry } from '@allianz/ng-aquila/icon';
import { NX_DATE_FORMATS, NxDateFormats } from '@allianz/ng-aquila/datefield';
import { NxIsoDateModule } from '@allianz/ng-aquila/iso-date-adapter';
import { provideAllianzIcons } from '@allianz/ngx-brand-kit/icon';
import { DomSanitizer } from '@angular/platform-browser';

import { routes } from './app.routes';
import { PrototypeEntryService } from './core/services/prototype-entry.service';

// Manual SVG fallbacks ONLY for icons NOT in the Allianz icon font.
// Everything that exists in @allianz/ngx-brand-kit (info-circle-o, speech-bubble-o,
// bolt-o, clock-o, paperclip, launch, ellipsis-v, search, bell-o, product-*, …)
// must NOT be redefined here, or the manual SVG overrides the proper font glyph
// — that's how outline icons started rendering as filled FontAwesome shapes.
// App-wide date format: DD-MM-YYYY everywhere (dayjs tokens, consumed by the
// NxIsoDateAdapter). Overrides NxIsoDateModule's locale-default 'L' (which
// resolved to US MM/DD/YYYY). Single source of truth for every nxDatefield.
const APP_DATE_FORMATS: NxDateFormats = {
  parse:   { dateInput: 'DD-MM-YYYY' },
  display: {
    dateInput:          'DD-MM-YYYY',
    monthYearLabel:     'MMM YYYY',
    dateA11yLabel:      'DD MMMM YYYY',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

const SVG_ICONS: Record<string, string> = {
  'grid': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 72C0 49.9 17.9 32 40 32h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40H40C17.9 160 0 142.1 0 120V72zM0 232c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40H40c-22.1 0-40-17.9-40-40V232zm128 160v48c0 22.1-17.9 40-40 40H40c-22.1 0-40-17.9-40-40V392c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40zM160 72c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V72zm128 160v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V232c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40zM160 392c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V392zm160-320c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V72zm128 160v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V232c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40zM320 392c0-22.1 17.9-40 40-40h48c22.1 0 40 17.9 40 40v48c0 22.1-17.9 40-40 40h-48c-22.1 0-40-17.9-40-40V392z"/></svg>`,
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withRouterConfig({ onSameUrlNavigation: 'reload' }), withViewTransitions()),
    provideHttpClient(),
    provideAnimations(),
    { provide: LOCALE_ID, useValue: 'en' },
    importProvidersFrom(NxExpertModule, NxIsoDateModule),
    // Must come AFTER NxIsoDateModule so it overrides that module's default
    // NX_DATE_FORMATS ('L' → US format). Forces DD-MM-YYYY app-wide.
    { provide: NX_DATE_FORMATS, useValue: APP_DATE_FORMATS },
    provideAllianzIcons(),
    {
      provide: NX_ICON_INITIALIZER,
      useFactory: (sanitizer: DomSanitizer) => (registry: NxIconRegistry) => {
        // Register only the small set of non-Allianz icons we need (e.g. `grid`).
        Object.entries(SVG_ICONS).forEach(([name, svg]) => {
          registry.addSvgIconLiteral(name, sanitizer.bypassSecurityTrustHtml(svg));
        });
      },
      deps: [DomSanitizer],
      multi: true,
    },
    // `?pt=<ticketId>` on the landing URL means "a tracker link opened this tab" —
    // seed that ticket's scenario state here, BEFORE provideRouter runs its initial
    // navigation, so the target page's first render already sees the right data.
    // Bootstrap waits on the returned promise; it resolves immediately when the
    // param is absent, which is every normal page load.
    provideAppInitializer(() => inject(PrototypeEntryService).applyFromUrl()),
  ],
};
