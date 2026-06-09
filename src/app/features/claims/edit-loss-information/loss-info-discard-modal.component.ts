import { Component, inject } from '@angular/core';
import { NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';

export type LossInfoDiscardModalResult = 'discard' | null;

@Component({
  selector: 'app-loss-info-discard-modal',
  standalone: true,
  imports: [NxModalModule, NxButtonModule],
  template: `
    <header class="ldm-header">
      <h2 class="ldm-title">Discard changes?</h2>
    </header>
    <div class="ldm-body">
      <p>Your edits to the loss information will be lost. This cannot be undone.</p>
    </div>
    <footer class="ldm-footer">
      <button nxButton="tertiary" type="button" (click)="ref.close(null)">Keep editing</button>
      <button nxButton="primary" type="button" (click)="ref.close('discard')">Discard</button>
    </footer>
  `,
  styles: [`
    :host { display: block; }
    .ldm-header { padding: 24px 24px 0; }
    .ldm-title  { font-size: var(--paragraph-01-font-size); font-weight: 700; color: var(--text-01); margin: 0; }
    .ldm-body   { padding: 16px 24px; font-size: 14px; color: var(--text-muted); }
    .ldm-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 0 24px 24px; }
  `],
})
export class LossInfoDiscardModalComponent {
  readonly ref = inject<NxModalRef<LossInfoDiscardModalComponent, LossInfoDiscardModalResult>>(NxModalRef);
}
