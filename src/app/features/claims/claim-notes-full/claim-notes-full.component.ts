import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxAvatarModule } from '@allianz/ng-aquila/avatar';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { Note } from '../../../core/models';
import { MockNotesService } from '../../../core/mock/services/mock-notes.service';
import { ClaimNotesPanelComponent } from '../claim-notes-panel/claim-notes-panel.component';

@Component({
  selector: 'app-claim-notes-full',
  standalone: true,
  imports: [CommonModule, RouterLink, NxIconModule, NxButtonModule, NxAvatarModule, NxContextMenuModule, ClaimNotesPanelComponent],
  template: `
    <div class="cnf-wrap">
      <div class="cnf-header">
        <a class="cnf-back" [routerLink]="['/claims', claimId, 'overview']">
          <nx-icon name="arrow-left" size="s"></nx-icon>
          Back to claim
        </a>
        <h1 class="cnf-title">Notes</h1>
      </div>
      <div class="cnf-body">
        <app-claim-notes-panel [claimId]="claimId"></app-claim-notes-panel>
      </div>
    </div>
  `,
  styles: [`
    .cnf-wrap { display: flex; flex-direction: column; height: 100%; }
    .cnf-header {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 24px; border-bottom: 1px solid var(--ui-04);
      flex-shrink: 0;
    }
    .cnf-back {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--interactive-primary); font-size: var(--paragraph-03-font-size);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .cnf-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--text-01); }
    .cnf-body { flex: 1; overflow: hidden; display: flex; }
    app-claim-notes-panel { flex: 1; width: 100% !important; border-left: none !important; }
  `],
})
export class ClaimNotesFullComponent {
  private readonly route = inject(ActivatedRoute);

  readonly claimId = this.route.snapshot.paramMap.get('id')
    ?? this.route.parent?.snapshot.paramMap.get('id') ?? '';
}
