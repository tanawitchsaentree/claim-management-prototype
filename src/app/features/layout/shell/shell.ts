import { Component, computed, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';
import { ClaimRightStripComponent } from '../claim-right-strip/claim-right-strip.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, Navbar, Sidebar, ClaimRightStripComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  private readonly router = inject(Router);

  private readonly url$ = this.router.events.pipe(
    filter(e => e instanceof NavigationEnd),
    map(e => (e as NavigationEnd).urlAfterRedirects),
    startWith(this.router.url),
  );

  private readonly urlSignal = toSignal(this.url$, { initialValue: this.router.url });

  readonly showRightStrip = computed(() => {
    const match = this.urlSignal().match(/^\/claims\/([^/]+)/);
    return !!match && match[1] !== 'new';
  });
}
