import { Component } from '@angular/core';
import { Navbar } from '../layout/navbar/navbar';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [Navbar],
  template: `
    <app-navbar />
    <div class="approvals-page">
      <h2 class="approvals-page__title">Approvals</h2>
      <p class="approvals-page__hint">Approval queue — coming soon.</p>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--ui-01); }
    .approvals-page { max-width: 1200px; padding: 32px; }
    .approvals-page__title {
      margin: 0 0 8px;
      font-size: var(--paragraph-01-font-size);
      font-weight: 600;
      color: var(--text-01);
    }
    .approvals-page__hint {
      margin: 0;
      font-size: var(--paragraph-04-font-size);
      color: var(--text-muted);
      font-style: italic;
    }
  `],
})
export class ApprovalsComponent {}
