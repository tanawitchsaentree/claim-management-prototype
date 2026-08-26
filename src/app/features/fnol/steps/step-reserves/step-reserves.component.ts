import { Component, inject, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import { Reserve, ReserveNarrative, ReservesPolicyData, ReserveType, RESERVE_TYPE_LABELS, SubReserve } from '../../../../core/models/reserve.model';
import { AddReserveModalComponent, AddReserveResult } from '../../components/add-reserve-modal/add-reserve-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ReserveNarrativePanelComponent } from './components/reserve-narrative-panel/reserve-narrative-panel.component';
import { ReserveListComponent, ReserveListViewMode } from './components/reserve-list/reserve-list.component';
import { ReserveDetailPanelComponent, SectionMutation } from './components/reserve-detail-panel/reserve-detail-panel.component';

@Component({
  selector: 'app-step-reserves',
  standalone: true,
  imports: [
    CommonModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxModalModule,
    ConfirmDialogComponent,
    WizardFooterComponent,
    EmptyStateComponent,
    ReserveNarrativePanelComponent,
    ReserveListComponent,
    ReserveDetailPanelComponent,
  ],
  templateUrl: './step-reserves.component.html',
  styleUrl: './step-reserves.component.scss',
})
export class StepReservesComponent implements OnInit, OnDestroy {
  private readonly reservesSvc  = inject(MockReservesService);
  private readonly fnolState    = inject(FnolStateService);
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly router       = inject(Router);
  private readonly toast        = inject(ToastService);

  readonly data$      = new BehaviorSubject<ReservesPolicyData | null>(null);
  readonly typeLabels = RESERVE_TYPE_LABELS;

  // Master/detail squeeze mode
  readonly selectedSection = signal<Reserve | null>(null);
  readonly isSqueezed = computed(() => !!this.selectedSection());

  // Edit state — drives the "Save & back" vs "Back to list" label and the
  // "Saved Xs ago" indicator on the right-panel header.
  readonly isDirty     = signal(false);
  readonly lastSavedAt = signal<Date | null>(null);
  readonly nowTick     = signal(Date.now());

  readonly savedAgoLabel = computed<string | null>(() => {
    const t = this.lastSavedAt();
    if (!t) return null;
    this.nowTick();                                  // re-run every tick
    const seconds = Math.max(0, Math.floor((Date.now() - t.getTime()) / 1000));
    if (seconds < 5)   return 'Saved just now';
    if (seconds < 60)  return `Saved ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)  return `Saved ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Saved ${hours}h ago`;
  });

  private savedAgoTimer: ReturnType<typeof setInterval> | null = null;

  // Reacts to the reserve-list's view-mode toggle: lazily fetch all-policy
  // data the first time the user leaves "This policy" — allPolicies is
  // owned here (not by the list) because isCrossPolicy/policyForReserve
  // below need it too.
  async onViewModeChanged(m: ReserveListViewMode): Promise<void> {
    if (m !== 'one' && this.allPolicies().length === 0) {
      const all = await firstValueFrom(this.reservesSvc.getReservesForAllPolicies());
      this.allPolicies.set(all);
    }
  }

  // All-policy data (lazy-loaded when user picks all-flat/all-grouped)
  readonly allPolicies = signal<ReservesPolicyData[]>([]);

  // True when the currently selected section belongs to a different policy
  // than the FNOL flow's policy → panel is read-only.
  readonly isCrossPolicy = computed(() => {
    const sel = this.selectedSection();
    if (!sel) return false;
    const ownerPolicy = this.policyForReserve(sel.reserveId);
    return ownerPolicy !== this.policyNumber;
  });

  policyForReserve(reserveId: string): string | null {
    if (this.data$.value?.reserves.some(r => r.reserveId === reserveId)) {
      return this.policyNumber;
    }
    for (const pol of this.allPolicies()) {
      if (pol.reserves.some(r => r.reserveId === reserveId)) return pol.policyNumber;
    }
    return null;
  }

  // Set right before selectSection() when a newly-added reserve should open
  // with a specific tab active (see onAddReserve below); the detail panel
  // owns activeTab itself and only seeds from this on a real change.
  pendingActiveTab: ReserveType | null = null;

  onSectionMutated({ reserve, markDirty }: SectionMutation): void {
    this.selectedSection.set(reserve);
    if (markDirty) this.isDirty.set(true);
  }

  async selectSection(reserve: Reserve): Promise<void> {
    // Persist any in-flight edits to the previously selected section before
    // switching away (prevents data loss when clicking a different row).
    if (this.selectedSection() && this.selectedSection()?.reserveId !== reserve.reserveId) {
      await this.persistSelectedSection();
    }
    // Deep-clone so panel edits don't mutate the cached row until persisted.
    this.selectedSection.set(structuredClone(reserve));
    this.isDirty.set(false);
    this.lastSavedAt.set(null);
    this.startSavedAgoTicker();
    this.lockBodyScroll();
  }

  private startSavedAgoTicker(): void {
    this.stopSavedAgoTicker();
    this.savedAgoTimer = setInterval(() => this.nowTick.set(Date.now()), 15000);
  }

  private stopSavedAgoTicker(): void {
    if (this.savedAgoTimer) { clearInterval(this.savedAgoTimer); this.savedAgoTimer = null; }
  }

  async onSaveChanges(): Promise<void> {
    if (this.isCrossPolicy() || !this.isDirty()) return;
    await this.persistSelectedSection();
    this.toast.success('Changes saved');
  }

  async closeSection(): Promise<void> {
    if (this.isDirty() && !this.isCrossPolicy()) {
      const data: ConfirmDialogData = {
        title:         'Discard unsaved changes?',
        message:       'Your edits to this section will be lost.',
        confirmLabel:  'Discard',
        cancelLabel:   'Keep editing',
        confirmDanger: true,
      };
      const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '440px', maxWidth: '92vw' });
      const discard = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
      if (!discard) return;
    }
    this.selectedSection.set(null);
    this.isDirty.set(false);
    this.lastSavedAt.set(null);
    this.stopSavedAgoTicker();
    this.unlockBodyScroll();
  }

  private async persistSelectedSection(): Promise<void> {
    const sel = this.selectedSection();
    if (!sel) return;
    // Don't write back changes for cross-policy view (read-only mode).
    if (this.isCrossPolicy()) return;
    await firstValueFrom(this.reservesSvc.replaceReserve(this.policyNumber, sel));
    await this.loadReserves();
    this.lastSavedAt.set(new Date());
    this.isDirty.set(false);
  }

  get policyNumber(): string { return this.fnolState.policyNumber; }
  get reserves(): Reserve[]  { return this.data$.value?.reserves ?? []; }
  get totalReserve(): number { return this.data$.value?.totalReserve ?? 0; }
  get allianzShare(): number { return this.data$.value?.allianzShare ?? 50; }

  get narrative(): ReserveNarrative | undefined { return this.data$.value?.narrative; }

  async ngOnInit(): Promise<void> {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient && !this.fnolState.path) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.loadReserves();
  }

  onNarrativeSaved(): void {
    this.loadReserves();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    this.stopSavedAgoTicker();
  }

  // ── Add reserve ─────────────────────────────────────────────────────────────

  async onAddReserve(): Promise<void> {
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: {
        policyNumber: this.policyNumber,
        sections: this.reserves,
      },
      width: '480px',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddReserveResult | null | undefined;
    if (!result) return;

    // Find the chosen section + push a fresh sub-reserve into the chosen tab
    const section = this.reserves.find(r => r.reserveId === result.reserveId);
    if (!section) return;
    const sectionClone = structuredClone(section);

    const tab = result.reserveType;
    const blank: SubReserve = {
      subReserveId: `${section.reserveId}-${tab}-${Date.now()}`,
      subType: 'Lorem ipsum',
      currency: section.currency,
      amount: 0,
      coInsurance: 'RI',
    };

    if (result.itemLevel && result.damagedItemId) {
      const item = (sectionClone.damagedItems ?? []).find(i => i.damagedItemId === result.damagedItemId);
      if (item) {
        const list = item.subReserves[tab] ?? [];
        item.subReserves = { ...item.subReserves, [tab]: [...list, blank] };
        item.expanded = true;
      }
    } else {
      // Section-level reserve: stash on first damaged item if exists, else create a synthetic one.
      const items = sectionClone.damagedItems ?? [];
      if (items.length === 0) {
        items.push({
          damagedItemId: `${section.reserveId}-DI-1`,
          itemName: `${section.partyName} — ${section.damageType}`,
          expanded: true,
          subReserves: { [tab]: [blank] },
        });
        sectionClone.damagedItems = items;
      } else {
        const first = items[0];
        const list = first.subReserves[tab] ?? [];
        first.subReserves = { ...first.subReserves, [tab]: [...list, blank] };
        first.expanded = true;
      }
    }

    // Recompute totals on the clone, then persist.
    this.recomputeSectionTotals(sectionClone);
    await firstValueFrom(this.reservesSvc.replaceReserve(this.policyNumber, sectionClone));
    await this.loadReserves();

    // Open squeezed mode + auto-select the just-added section + switch tab
    const refreshed = this.reserves.find(r => r.reserveId === sectionClone.reserveId);
    if (refreshed) {
      this.pendingActiveTab = tab;
      await this.selectSection(refreshed);
    }

    this.toast.success('Reserve added', `Added to ${this.typeLabels[tab].toLowerCase()} reserves.`);
  }

  private recomputeSectionTotals(sel: Reserve): void {
    const total = (type: ReserveType): number =>
      (sel.damagedItems ?? []).reduce(
        (sum, it) => sum + (it.subReserves[type] ?? []).reduce((s, r) => s + r.amount, 0),
        0,
      );
    sel.subAmounts = {
      indemnity:  total('indemnity'),
      expenses:   total('expenses'),
      recoveries: total('recoveries'),
    };
    sel.amount = (sel.subAmounts.indemnity ?? 0) + (sel.subAmounts.expenses ?? 0) + (sel.subAmounts.recoveries ?? 0);
  }

  // ── Kebab actions ────────────────────────────────────────────────────────────

  async onEditReserve(reserve: Reserve): Promise<void> {
    const ref = this.dialogSvc.open(AddReserveModalComponent, {
      data: { policyNumber: this.policyNumber, prefill: reserve },
      width: '480px',
    });
    const result = await firstValueFrom(ref.afterClosed()) as AddReserveResult | null | undefined;
    if (!result) return;
    await firstValueFrom(this.reservesSvc.updateReserve(this.policyNumber, reserve.reserveId, result));
    this.loadReserves();
  }

  async onRemoveReserve(reserve: Reserve): Promise<void> {
    const data: ConfirmDialogData = {
      title:         'Remove reserve',
      message:       `Remove reserve for "${reserve.partyName} — ${reserve.damageType}"?`,
      confirmLabel:  'Remove',
      confirmDanger: true,
    };
    const ref = this.dialogSvc.open(ConfirmDialogComponent, { data, width: '440px', maxWidth: '92vw' });
    const confirmed = await firstValueFrom(ref.afterClosed()) as boolean | undefined;
    if (!confirmed) return;
    await firstValueFrom(this.reservesSvc.removeReserve(this.policyNumber, reserve.reserveId));
    await this.autoArchiveNarrativeIfNeeded();
    this.loadReserves();
    this.toast.info('Reserve removed', `${reserve.partyName} — ${reserve.damageType}`);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  onCancel(): void { this.router.navigate(['/dashboard']); }
  onBack(): void   { this.router.navigate(['/fnol/parties']); }
  onNext(): void   { this.fnolState.markStepComplete('reserves'); this.router.navigate(['/fnol/summary']); }

  // ── Private ──────────────────────────────────────────────────────────────────

  private async loadReserves(): Promise<void> {
    const data = await firstValueFrom(this.reservesSvc.getReservesForPolicy(this.policyNumber));
    this.data$.next(data);
  }

  private async autoArchiveNarrativeIfNeeded(): Promise<void> {
    const data = this.data$.value;
    if (!data || !data.narrative || data.narrative.archivedAt) return;
    const total = data.reserves.reduce((s, r) => s + (r.amount || 0), 0);
    if (total > 0) {
      await firstValueFrom(this.reservesSvc.archiveNarrative(this.policyNumber));
    }
  }

  private lockBodyScroll(): void   { document.body.style.overflow = 'hidden'; }
  private unlockBodyScroll(): void { document.body.style.overflow = ''; }
}
