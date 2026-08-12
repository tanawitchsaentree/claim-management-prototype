import { Component, inject } from '@angular/core';
import { NxModalModule, NxModalRef } from '@allianz/ng-aquila/modal';
import { NxButtonModule } from '@allianz/ng-aquila/button';

export type EditClaimDiscardModalResult = 'discard' | null;

@Component({
  selector: 'app-edit-claim-discard-modal',
  standalone: true,
  imports: [NxModalModule, NxButtonModule],
  template: `
    <header class="edm-header">
      <h2 class="edm-title">Discard changes?</h2>
    </header>
    <div class="edm-body">
      <p>Your edits to this claim will be lost. This cannot be undone.</p>
    </div>
    <footer class="edm-footer">
      <button nxButton="tertiary" type="button" (click)="ref.close(null)">Keep editing</button>
      <button nxButton="primary" type="button" (click)="ref.close('discard')">Discard</button>
    </footer>
  `,
  styles: [`
    :host { display: block; }
    .edm-header { padding: 24px 24px 0; }
    .edm-title  { font-size: var(--paragraph-01-font-size); font-weight: 700; color: var(--text-01); margin: 0; }
    .edm-body   { padding: 16px 24px; font-size: var(--paragraph-03-font-size); color: var(--text-muted); }
    .edm-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 0 24px 24px; }
  `],
})
export class EditClaimDiscardModalComponent {
  readonly ref = inject<NxModalRef<EditClaimDiscardModalComponent, EditClaimDiscardModalResult>>(NxModalRef);
}
