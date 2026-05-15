import { Component, OnInit, inject, isDevMode, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTaglistModule } from '@allianz/ng-aquila/taglist';
import { ClaimDevHelperService, DevTicket, BuildStatus } from './claim-dev-helper.service';

@Component({
  selector: 'app-claim-dev-banner',
  standalone: true,
  imports: [CommonModule, NxFormfieldModule, NxDropdownModule, NxButtonModule, NxTaglistModule],
  templateUrl: './claim-dev-banner.component.html',
  styleUrl: './claim-dev-banner.component.scss',
})
export class ClaimDevBannerComponent implements OnInit {
  readonly helper = inject(ClaimDevHelperService);

  readonly visible = isDevMode();

  readonly activeAcLabel = computed<string | null>(() => {
    const acId = this.helper.activeAcId();
    if (!acId) return null;
    for (const card of this.helper.availableCards()) {
      const ac = card.ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) return `Testing ${ac.id}`;
    }
    return acId;
  });

  ngOnInit(): void {
    if (!this.visible) return;
    this.helper.loadTickets();
  }

  onTicketSelected(id: string | null): void {
    this.helper.selectTicket(id ?? null);
  }

  openDetails(): void {
    const card = this.helper.availableCards()
      .find(c => c.id === this.helper.selectedTicket()?.ticketId);
    if (card) this.helper.openDetailsFor(card, null);
  }

  reopenForActiveAc(): void {
    const acId = this.helper.activeAcId();
    const card = this.helper.availableCards()
      .find(c => c.ticket.acceptanceCriteria.some(a => a.id === acId));
    if (card) this.helper.openDetailsFor(card, acId);
  }

  clearActiveAc(): void {
    this.helper.clearActiveAc();
  }

  onRestore(acId: string): void {
    const card = this.helper.availableCards()
      .find(c => c.ticket.acceptanceCriteria.some(a => a.id === acId));
    if (!card) return;
    this.helper.clearMinimized();
    this.helper.openDetailsFor(card, acId);
  }

  onReset(): void {
    this.helper.applyScenario({});
    window.location.reload();
  }

  countByStatus(ticket: DevTicket, status: BuildStatus): number {
    return ticket.acceptanceCriteria.filter(ac => ac.buildStatus === status).length;
  }

  verifiedCount(ticket: DevTicket): number {
    return ticket.acceptanceCriteria.filter(ac =>
      this.helper.isVerified(ticket.ticketId, ac.id)
    ).length;
  }

}
