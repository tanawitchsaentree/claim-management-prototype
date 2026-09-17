import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxButtonModule } from '@allianz/ng-aquila/button';

// Every claim-closure blocker's "Go to X" link used to be a flat teleport —
// close the modal, navigate, land with zero context on why you're there or
// how to get back. Drop this at the top of any page a blocker can link to
// (Sections, Financial, Litigation, Provider management, Recoveries) — it
// stays invisible unless the two query params below are present, so it's
// safe to add unconditionally.
@Component({
  selector: 'app-blocker-return-banner',
  standalone: true,
  imports: [NxMessageModule, NxButtonModule, RouterLink],
  templateUrl: './blocker-return-banner.component.html',
  styleUrl: './blocker-return-banner.component.scss'
})
export class BlockerReturnBannerComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly resolveLabel = toSignal(
    this.route.queryParamMap.pipe(map(qp => qp.get('resolveBlocker')))
  );
  readonly returnTo = toSignal(this.route.queryParamMap.pipe(map(qp => qp.get('returnTo'))));

  dismiss(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { resolveBlocker: null, returnTo: null },
      queryParamsHandling: 'merge'
    });
  }
}
