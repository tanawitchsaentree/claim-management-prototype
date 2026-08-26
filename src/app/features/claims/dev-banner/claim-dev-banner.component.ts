import { Component, OnInit, effect, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTaglistModule } from '@allianz/ng-aquila/taglist';
import { ClaimDevHelperService, DevTicket, BuildStatus } from './claim-dev-helper.service';
import { ReferenceViewService, ReferenceVariant } from '../claim-reference-panel/reference-view.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-claim-dev-banner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NxFormfieldModule, NxDropdownModule, NxButtonModule, NxTaglistModule],
  templateUrl: './claim-dev-banner.component.html',
  styleUrl: './claim-dev-banner.component.scss',
})
export class ClaimDevBannerComponent implements OnInit {
  readonly helper  = inject(ClaimDevHelperService);
  readonly refSvc  = inject(ReferenceViewService);

  readonly visible = true;

  // User-collapsible, not a build/env gate — the banner still mounts and
  // loads tickets exactly as before; this only hides its markup, and
  // remembers the choice per-browser so it doesn't need re-hiding every
  // reload. Deliberately separate from `enabled`/`isDevMode()` gating,
  // which PROJECT.md rules out for security/parity reasons.
  private static readonly COLLAPSE_KEY = 'dev-banner:collapsed';
  readonly collapsed = signal(localStorage.getItem(ClaimDevBannerComponent.COLLAPSE_KEY) === '1');

  hide(): void {
    this.collapsed.set(true);
    localStorage.setItem(ClaimDevBannerComponent.COLLAPSE_KEY, '1');
  }

  show(): void {
    this.collapsed.set(false);
    localStorage.removeItem(ClaimDevBannerComponent.COLLAPSE_KEY);
  }

  // Reviewer split (tour-system audit, 2026-08-20): dev-only widgets
  // (Reset, reference-view variant picker) hide when devBannerMode is
  // 'reviewer'. 'full' keeps everything exactly as before.
  readonly isFullMode = environment.devBannerMode === 'full';

  readonly ticketCtrl   = new FormControl<string | null>(null);
  readonly variantCtrl  = new FormControl<ReferenceVariant>('none');

  readonly variantOptions: { value: ReferenceVariant; label: string }[] = [
    { value: 'none',    label: 'Off'                      },
    { value: 'panel',   label: 'Variant 1 — Side panel'   },
    { value: 'tabs',    label: 'Variant 2 — Tab bar'      },
    { value: 'popover', label: 'Variant 3 — Hover preview' },
  ];

  constructor() {
    effect(() => {
      const id = this.helper.selectedTicket()?.ticketId ?? null;
      if (this.ticketCtrl.value !== id) {
        this.ticketCtrl.setValue(id, { emitEvent: false });
      }
    });
    // Keep dropdown in sync when refSvc.variant changes externally (e.g. close btn)
    effect(() => {
      const v = this.refSvc.variant();
      if (this.variantCtrl.value !== v) {
        this.variantCtrl.setValue(v, { emitEvent: false });
      }
    });
  }

  readonly activeAcLabel = computed<string | null>(() => {
    const acId = this.helper.activeAcId();
    if (!acId) return null;
    for (const card of this.helper.availableCards()) {
      const ac = card.ticket.acceptanceCriteria.find(a => a.id === acId);
      if (ac) return `Testing ${ac.id}`;
    }
    return acId;
  });

  // Tickets grouped by module — for dropdown's <nx-dropdown-group> headers.
  readonly groupedTickets = computed<Array<{ module: string; tickets: DevTicket[] }>>(() => {
    const map = new Map<string, DevTicket[]>();
    for (const t of this.helper.tickets()) {
      const key = t.module || 'Other';
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([module, tickets]) => ({ module, tickets }));
  });

  ngOnInit(): void {
    if (!this.visible) return;
    this.helper.loadTickets();
  }

  onTicketSelected(id: string | null): void {
    this.helper.selectTicket(id ?? null);
  }

  onTicketSelectionChange(event: { value: string | null } | null): void {
    this.helper.selectTicket(event?.value ?? null);
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

  onVariantChange(event: { value: ReferenceVariant } | null): void {
    const v = event?.value ?? 'none';
    this.refSvc.setVariant(v, this.helper.currentClaimId());
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
