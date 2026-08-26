import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { animate, style, transition, trigger, query, stagger } from '@angular/animations';
import { DecimalPipe, LowerCasePipe } from '@angular/common';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxDropdownModule } from '@allianz/ng-aquila/dropdown';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { MockReservesService } from '../../../../../../core/mock/services/mock-reserves.service';
import { EmptyStateComponent } from '../../../../../../shared/components/empty-state/empty-state.component';
import {
  Reserve, ReservesPolicyData, ReserveType, RESERVE_TYPE_LABELS, DamagedItem, SubReserve, CoInsuranceFlag,
} from '../../../../../../core/models/reserve.model';

export interface SectionMutation {
  reserve: Reserve;
  markDirty: boolean;
}

@Component({
  selector: 'app-reserve-detail-panel',
  standalone: true,
  imports: [
    DecimalPipe, LowerCasePipe,
    NxIconModule, NxButtonModule, NxTableModule, NxFormfieldModule, NxInputModule,
    NxDropdownModule, NxContextMenuModule, NxSwitcherModule, EmptyStateComponent,
  ],
  templateUrl: './reserve-detail-panel.component.html',
  styleUrl: './reserve-detail-panel.component.scss',
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
export class ReserveDetailPanelComponent implements OnChanges {
  @Input({ required: true }) reserve!: Reserve;
  @Input({ required: true }) isCrossPolicy = false;
  @Input({ required: true }) allPolicies: ReservesPolicyData[] = [];
  @Input({ required: true }) isDirty = false;
  @Input() savedAgoLabel: string | null = null;
  // Force the active tab open right after a new sub-reserve is added from
  // outside this panel (see step-reserves' onAddReserve) — the panel owns
  // activeTab itself and only seeds from this on a real change.
  @Input() initialActiveTab: ReserveType | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saveRequested = new EventEmitter<void>();
  @Output() sectionMutated = new EventEmitter<SectionMutation>();

  private readonly reservesSvc = inject(MockReservesService);

  readonly typeLabels = RESERVE_TYPE_LABELS;
  readonly subTypes: ReserveType[] = ['indemnity', 'expenses', 'recoveries'];
  readonly coInsuranceOptions: CoInsuranceFlag[] = ['RI', 'CO', 'NONE'];
  readonly subTypeOptions = ['Lorem ipsum', 'Direct loss', 'Consequential', 'Salvage'];

  readonly activeTab = signal<ReserveType>('indemnity');
  setActiveTab(t: ReserveType): void { this.activeTab.set(t); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialActiveTab'] && this.initialActiveTab) {
      this.activeTab.set(this.initialActiveTab);
    }
  }

  readonly damagedItemLevel = signal<boolean>(true);
  toggleDamagedItemLevel(): void { this.damagedItemLevel.update(v => !v); }

  // Only ever called from behind an isCrossPolicy check, so the reserve is
  // guaranteed to belong to another policy — no need to check "own" reserves.
  crossPolicyLabel(reserveId: string): string {
    for (const pol of this.allPolicies) {
      if (pol.reserves.some(r => r.reserveId === reserveId)) return this.policyLabel(pol.policyNumber);
    }
    return '';
  }

  private policyLabel(policyNumber: string): string {
    const seed = this.reservesSvc.policySeeds().find(s => s.policyNumber === policyNumber);
    return seed?.policyLabel ?? policyNumber;
  }

  sectionTotal(reserve: Reserve): number {
    const s = reserve.subAmounts ?? {};
    return (s.indemnity ?? 0) + (s.expenses ?? 0) + (s.recoveries ?? 0);
  }

  sectionSub(reserve: Reserve, type: ReserveType): number {
    return reserve.subAmounts?.[type] ?? 0;
  }

  itemAmount(item: DamagedItem, type: ReserveType): number {
    return (item.subReserves[type] ?? []).reduce((s, r) => s + r.amount, 0);
  }

  trackByItem(_: number, item: DamagedItem): string { return item.damagedItemId; }
  trackBySub(_: number, sub: SubReserve): string { return sub.subReserveId; }

  expandItem(itemId: string, value: boolean): void {
    if (!this.reserve.damagedItems) return;
    const sel = structuredClone(this.reserve);
    sel.damagedItems = (sel.damagedItems ?? []).map(it =>
      it.damagedItemId === itemId ? { ...it, expanded: value } : it,
    );
    this.sectionMutated.emit({ reserve: sel, markDirty: false });
  }

  toggleItem(itemId: string): void {
    const cur = this.reserve.damagedItems?.find(it => it.damagedItemId === itemId);
    this.expandItem(itemId, !cur?.expanded);
  }

  // ── Sub-reserve add/edit/remove ─────────────────────────────────────────────

  onAddSubReserve(item: DamagedItem): void {
    if (this.isCrossPolicy || !this.reserve.damagedItems) return;
    const tab = this.activeTab();
    const sel = structuredClone(this.reserve);
    const selItem = (sel.damagedItems ?? []).find(it => it.damagedItemId === item.damagedItemId);
    if (!selItem) return;
    const list = selItem.subReserves[tab] ?? [];
    const next: SubReserve = {
      subReserveId: `${item.damagedItemId}-${tab}-${list.length + 1}-${Date.now()}`,
      subType: 'Lorem ipsum',
      currency: sel.currency,
      amount: 0,
      coInsurance: 'RI',
    };
    selItem.subReserves = { ...selItem.subReserves, [tab]: [...list, next] };
    this.recomputeSectionTotals(sel);
    this.sectionMutated.emit({ reserve: sel, markDirty: true });
  }

  onUpdateSub(item: DamagedItem, sub: SubReserve, patch: Partial<SubReserve>): void {
    if (this.isCrossPolicy || !this.reserve.damagedItems) return;
    const tab = this.activeTab();
    const sel = structuredClone(this.reserve);
    const selItem = (sel.damagedItems ?? []).find(it => it.damagedItemId === item.damagedItemId);
    if (!selItem) return;
    const list = (selItem.subReserves[tab] ?? []).map(s =>
      s.subReserveId === sub.subReserveId ? { ...s, ...patch } : s,
    );
    selItem.subReserves = { ...selItem.subReserves, [tab]: list };
    this.recomputeSectionTotals(sel);
    this.sectionMutated.emit({ reserve: sel, markDirty: true });
  }

  onRemoveSub(item: DamagedItem, sub: SubReserve): void {
    if (this.isCrossPolicy || !this.reserve.damagedItems) return;
    const tab = this.activeTab();
    const sel = structuredClone(this.reserve);
    const selItem = (sel.damagedItems ?? []).find(it => it.damagedItemId === item.damagedItemId);
    if (!selItem) return;
    const list = (selItem.subReserves[tab] ?? []).filter(s => s.subReserveId !== sub.subReserveId);
    selItem.subReserves = { ...selItem.subReserves, [tab]: list };
    this.recomputeSectionTotals(sel);
    this.sectionMutated.emit({ reserve: sel, markDirty: true });
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
}
