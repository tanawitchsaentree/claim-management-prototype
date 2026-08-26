import { Component, inject, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxRadioModule } from '@allianz/ng-aquila/radio-button';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxDialogService, NxModalModule } from '@allianz/ng-aquila/modal';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockReservesService } from '../../../../core/mock/services/mock-reserves.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import { Reserve, ReserveNarrative, ReservesPolicyData, ReserveType, RESERVE_TYPE_LABELS, DamagedItem, SubReserve, CoInsuranceFlag } from '../../../../core/models/reserve.model';
import { LookupOption } from '../../../../core/models/lookup.model';
import { AddReserveModalComponent, AddReserveResult } from '../../components/add-reserve-modal/add-reserve-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-step-reserves',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxTableModule,
    NxMessageModule,
    NxFormfieldModule,
    NxInputModule,
    NxDropdownModule,
    NxRadioModule,
    NxContextMenuModule,
    NxModalModule,
    NxSwitcherModule,
    NxTabsModule,
    ConfirmDialogComponent,
    WizardFooterComponent,
    EmptyStateComponent,
  ],
  templateUrl: './step-reserves.component.html',
  styleUrl: './step-reserves.component.scss',
  animations: [
    trigger('detailSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(24px)' }),
        animate('220ms cubic-bezier(0.2, 0, 0, 1)',
          style({ opacity: 1, transform: 'translateX(0)' })),
      ]),
      transition(':leave', [
        animate('180ms ease-in',
          style({ opacity: 0, transform: 'translateX(24px)' })),
      ]),
    ]),
    trigger('itemExpand', [
      transition(':enter', [
        style({ opacity: 0, height: 0, overflow: 'hidden' }),
        animate('200ms cubic-bezier(0.2, 0, 0, 1)',
          style({ opacity: 1, height: '*' })),
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('160ms ease-in',
          style({ opacity: 0, height: 0 })),
      ]),
    ]),
    trigger('rowFade', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(-4px)' }),
          stagger('40ms', animate('180ms ease-out',
            style({ opacity: 1, transform: 'translateY(0)' }))),
        ], { optional: true }),
      ]),
    ]),
  ],
})
export class StepReservesComponent implements OnInit, OnDestroy {
  private readonly fb           = inject(FormBuilder);
  private readonly reservesSvc  = inject(MockReservesService);
  private readonly fnolState    = inject(FnolStateService);
  private readonly lookupSvc    = inject(MockLookupService);
  private readonly dialogSvc    = inject(NxDialogService);
  private readonly router       = inject(Router);
  private readonly toast        = inject(ToastService);

  readonly data$      = new BehaviorSubject<ReservesPolicyData | null>(null);
  readonly typeLabels = RESERVE_TYPE_LABELS;

  narrativeOptions: LookupOption[] = [];
  narrativeOpen = false;
  narrativeForm = this.fb.group({
    reasonKey: ['', Validators.required],
    notes:     [''],
  });

  // Master/detail squeeze mode + expandable rows
  readonly selectedSection = signal<Reserve | null>(null);
  readonly isSqueezed = computed(() => !!this.selectedSection());
  readonly expandedRows = signal<Set<string>>(new Set());

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

  // List view mode (only meaningful while squeezed)
  readonly viewMode = signal<'one' | 'all-flat' | 'all-grouped'>('one');
  async setViewMode(m: 'one' | 'all-flat' | 'all-grouped'): Promise<void> {
    this.viewMode.set(m);
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

  policyLabel(policyNumber: string): string {
    const seed = this.reservesSvc.policySeeds().find(s => s.policyNumber === policyNumber);
    return seed?.policyLabel ?? policyNumber;
  }

  // Rows visible in the left list (depends on viewMode + squeeze state).
  readonly visibleRows = computed<Reserve[]>(() => {
    if (!this.isSqueezed() || this.viewMode() === 'one') {
      return this.data$.value?.reserves ?? [];
    }
    return this.allPolicies().flatMap(p => p.reserves);
  });

  // Grouped rows for the all-grouped mode.
  readonly groupedRows = computed<Array<{ policyNumber: string; label: string; rows: Reserve[] }>>(() => {
    if (!(this.isSqueezed() && this.viewMode() === 'all-grouped')) return [];
    return this.allPolicies().map(p => ({
      policyNumber: p.policyNumber,
      label: this.policyLabel(p.policyNumber),
      rows: p.reserves,
    }));
  });

  readonly subTypes: ReserveType[] = ['indemnity', 'expenses', 'recoveries'];

  // Right-panel state (tabs + per-item-level toggle)
  readonly activeTab = signal<ReserveType>('indemnity');
  setActiveTab(t: ReserveType): void { this.activeTab.set(t); }

  readonly damagedItemLevel = signal<boolean>(true);
  toggleDamagedItemLevel(): void { this.damagedItemLevel.update(v => !v); }

  expandItem(itemId: string, value: boolean): void {
    const sel = this.selectedSection();
    if (!sel?.damagedItems) return;
    sel.damagedItems = sel.damagedItems.map(it =>
      it.damagedItemId === itemId ? { ...it, expanded: value } : it,
    );
    this.selectedSection.set({ ...sel });
  }

  toggleItem(itemId: string): void {
    const sel = this.selectedSection();
    const cur = sel?.damagedItems?.find(it => it.damagedItemId === itemId);
    this.expandItem(itemId, !cur?.expanded);
  }

  trackByItem(_: number, item: DamagedItem): string { return item.damagedItemId; }
  trackBySub(_: number, sub: SubReserve): string { return sub.subReserveId; }

  itemAmount(item: DamagedItem, type: ReserveType): number {
    return (item.subReserves[type] ?? []).reduce((s, r) => s + r.amount, 0);
  }

  // ── Sub-reserve add/edit/remove (in right panel) ────────────────────────────

  onAddSubReserve(item: DamagedItem): void {
    if (this.isCrossPolicy()) return;
    const sel = this.selectedSection();
    if (!sel?.damagedItems) return;
    const tab = this.activeTab();
    const list = item.subReserves[tab] ?? [];
    const next: SubReserve = {
      subReserveId: `${item.damagedItemId}-${tab}-${list.length + 1}-${Date.now()}`,
      subType: 'Lorem ipsum',
      currency: sel.currency,
      amount: 0,
      coInsurance: 'RI',
    };
    item.subReserves = { ...item.subReserves, [tab]: [...list, next] };
    sel.damagedItems = sel.damagedItems.map(it =>
      it.damagedItemId === item.damagedItemId ? { ...item } : it,
    );
    this.recomputeSectionTotals(sel);
    this.selectedSection.set({ ...sel });
    this.isDirty.set(true);
  }

  onUpdateSub(item: DamagedItem, sub: SubReserve, patch: Partial<SubReserve>): void {
    if (this.isCrossPolicy()) return;
    const sel = this.selectedSection();
    if (!sel?.damagedItems) return;
    const tab = this.activeTab();
    const list = (item.subReserves[tab] ?? []).map(s =>
      s.subReserveId === sub.subReserveId ? { ...s, ...patch } : s,
    );
    item.subReserves = { ...item.subReserves, [tab]: list };
    sel.damagedItems = sel.damagedItems.map(it =>
      it.damagedItemId === item.damagedItemId ? { ...item } : it,
    );
    this.recomputeSectionTotals(sel);
    this.selectedSection.set({ ...sel });
    this.isDirty.set(true);
  }

  onRemoveSub(item: DamagedItem, sub: SubReserve): void {
    if (this.isCrossPolicy()) return;
    const sel = this.selectedSection();
    if (!sel?.damagedItems) return;
    const tab = this.activeTab();
    const list = (item.subReserves[tab] ?? []).filter(s => s.subReserveId !== sub.subReserveId);
    item.subReserves = { ...item.subReserves, [tab]: list };
    sel.damagedItems = sel.damagedItems.map(it =>
      it.damagedItemId === item.damagedItemId ? { ...item } : it,
    );
    this.recomputeSectionTotals(sel);
    this.selectedSection.set({ ...sel });
    this.isDirty.set(true);
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

  readonly coInsuranceOptions: CoInsuranceFlag[] = ['RI', 'CO', 'NONE'];
  readonly subTypeOptions = ['Lorem ipsum', 'Direct loss', 'Consequential', 'Salvage'];

  toggleExpand(reserveId: string): void {
    this.expandedRows.update(set => {
      const next = new Set(set);
      if (next.has(reserveId)) next.delete(reserveId);
      else next.add(reserveId);
      return next;
    });
  }

  isExpanded(reserveId: string): boolean {
    return this.expandedRows().has(reserveId);
  }

  async selectSection(reserve: Reserve): Promise<void> {
    // Persist any in-flight edits to the previously selected section before
    // switching away (prevents data loss when clicking a different row).
    if (this.selectedSection() && this.selectedSection()?.reserveId !== reserve.reserveId) {
      await this.persistSelectedSection();
    }
    // Deep-clone so panel edits don't mutate the cached row until persisted.
    this.selectedSection.set(structuredClone(reserve));
    this.expandedRows.set(new Set());            // collapse all in squeezed mode
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

  isSelectedSection(reserve: Reserve): boolean {
    return this.selectedSection()?.reserveId === reserve.reserveId;
  }

  // Section summary helpers (right panel)
  sectionTotal(reserve: Reserve | null): number {
    if (!reserve) return 0;
    const s = reserve.subAmounts ?? {};
    return (s.indemnity ?? 0) + (s.expenses ?? 0) + (s.recoveries ?? 0);
  }

  sectionSub(reserve: Reserve | null, type: ReserveType): number {
    return reserve?.subAmounts?.[type] ?? 0;
  }

  get policyNumber(): string { return this.fnolState.selectedPolicy?.policyNumber ?? ''; }
  get reserves(): Reserve[]  { return this.data$.value?.reserves ?? []; }
  get totalReserve(): number { return this.data$.value?.totalReserve ?? 0; }
  get allianzShare(): number { return this.data$.value?.allianzShare ?? 50; }

  get narrative(): ReserveNarrative | undefined { return this.data$.value?.narrative; }

  // State 1: totalReserve=0, no saved narrative (or archived)
  get showNarrativeCta(): boolean {
    const n = this.narrative;
    return this.totalReserve === 0 && (!n || !!n.archivedAt);
  }

  // State 3: totalReserve=0, narrative saved and not archived
  get showNarrativeSaved(): boolean {
    const n = this.narrative;
    return this.totalReserve === 0 && !!n && !n.archivedAt;
  }

  get narrativeReasonLabel(): string {
    const n = this.narrative;
    if (!n) return '';
    return this.narrativeOptions.find(o => o.value === n.reasonKey)?.label ?? n.reasonKey;
  }

  async ngOnInit(): Promise<void> {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient && !this.fnolState.path) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.narrativeOptions = await firstValueFrom(this.lookupSvc.getNarrativeOptions());
    this.loadReserves();
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    this.stopSavedAgoTicker();
  }

  reserveTypeLabel(type?: ReserveType): string {
    return type ? RESERVE_TYPE_LABELS[type] : '—';
  }

  trackByReserve(_: number, r: Reserve): string { return r.reserveId; }

  // ── Null-reserve explanation ─────────────────────────────────────────────────

  openNarrative(): void {
    this.narrativeOpen = true;
    const n = this.narrative;
    if (n) this.narrativeForm.patchValue({ reasonKey: n.reasonKey, notes: n.notes ?? '' });
    else   this.narrativeForm.reset();
  }

  onCancelNarrative(): void {
    this.narrativeOpen = false;
    this.narrativeForm.reset();
  }

  async onSaveNarrative(): Promise<void> {
    if (this.narrativeForm.invalid) { this.narrativeForm.markAllAsTouched(); return; }
    const { reasonKey, notes } = this.narrativeForm.value;
    const narrative: ReserveNarrative = {
      reasonKey: reasonKey!,
      notes:     notes || undefined,
      savedAt:   new Date().toISOString(),
    };
    await firstValueFrom(this.reservesSvc.setNarrative(this.policyNumber, narrative));
    this.narrativeOpen = false;
    this.loadReserves();
    this.toast.success('Explanation saved');
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
      this.activeTab.set(tab);
      await this.selectSection(refreshed);
    }

    this.toast.success('Reserve added', `Added to ${this.typeLabels[tab].toLowerCase()} reserves.`);
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
