import { Component, inject } from '@angular/core';

import { NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { ClaimNotesPanelComponent } from '../claim-notes-panel/claim-notes-panel.component';

export interface ClaimNotesFullModalData {
  claimId: string;
}

// Opened as a bottom-sheet modal from ClaimNotesPanelComponent.onViewAll() —
// was a full-page route (/claims/:id/notes) that did nothing but wrap the
// same <app-claim-notes-panel> at full width with a "Back to claim" link.
// Nothing else linked to that route, so it's gone; this is a modal now, not
// a page, so "Back to claim" (browser-nav language) became a close button.
@Component({
  selector: 'app-claim-notes-full',
  standalone: true,
  imports: [NxIconModule, NxButtonModule, ClaimNotesPanelComponent],
  templateUrl: './claim-notes-full.component.html',
  styleUrl: './claim-notes-full.component.scss'
})
export class ClaimNotesFullComponent {
  readonly data = inject<ClaimNotesFullModalData>(NX_MODAL_DATA);
  readonly modalRef = inject<NxModalRef<ClaimNotesFullComponent>>(NxModalRef);

  close(): void {
    this.modalRef.close();
  }
}
