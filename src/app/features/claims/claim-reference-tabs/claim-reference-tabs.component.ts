import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { ReferenceViewService } from '../claim-reference-panel/reference-view.service';
import { ClaimReferencePanelComponent } from '../claim-reference-panel/claim-reference-panel.component';

interface Tab {
  claimId: string;
  isPrimary: boolean;
}

@Component({
  selector: 'app-claim-reference-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, NxIconModule, ClaimReferencePanelComponent],
  templateUrl: './claim-reference-tabs.component.html',
  styleUrl:    './claim-reference-tabs.component.scss',
})
export class ClaimReferenceTabsComponent {
  readonly svc = inject(ReferenceViewService);

  // activeTab: 'primary' | refClaimId
  readonly activeTab = signal<string>('primary');
}
