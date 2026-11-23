import { Component, HostListener, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NxModalRef, NX_MODAL_DATA } from '@allianz/ng-aquila/modal';
import { NxTabsModule } from '@allianz/ng-aquila/tabs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { MockLookupService } from '../../../../../../core/mock/services/mock-lookup.service';
import {
  applyReserveTotals,
  DamagedItem,
  RESERVE_TYPES,
  RESERVE_TYPE_LABELS,
  Reserve,
  ReserveType,
  SubReserve
} from '../../../../../../core/models/reserve.model';
import { ReserveClaim, ReserveClaimsService } from '../../../../services/reserve-claims.service';
import { ReserveLineChange, ReserveLinesComponent } from '../reserve-lines/reserve-lines.component';

export interface ReserveEditorData {
  claim: ReserveClaim;
  // Working copy: edited in place, the caller saves it once the sheet closes.
  line: Reserve;
  tab: ReserveType;
}

/**
 * Production's reserve editor (ReservesPage.ts): a full page titled with the
 * damage ("Material Damage"), tabs Indemnity / Expenses / Recoveries, a
 * sub-type and an Amount per tab, and a close icon that goes back with the
 * values kept. DESIGN DECISION RES-D4: shown as the app's near full-screen
 * bottom sheet (panelClass bottom-sheet-modal-panel, _bottom-sheet-layout),
 * not a route. Done and X both keep what was typed; there is no Cancel, as
 * in production.
 */
@Component({
  selector: 'app-reserve-editor-sheet',
  standalone: true,
  imports: [DecimalPipe, NxTabsModule, NxButtonModule, ReserveLinesComponent],
  templateUrl: './reserve-editor-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './reserve-editor-sheet.component.scss'
})
export class ReserveEditorSheetComponent {
  readonly data = inject<ReserveEditorData>(NX_MODAL_DATA);
  private readonly ref = inject<NxModalRef<ReserveEditorSheetComponent, boolean>>(NxModalRef);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly claimsSvc = inject(ReserveClaimsService);

  readonly line = this.data.line;
  readonly item: DamagedItem = this.line.damagedItems![0];
  readonly types = RESERVE_TYPES;
  readonly labels = RESERVE_TYPE_LABELS;
  readonly tabIndex = signal(RESERVE_TYPES.indexOf(this.data.tab));
  readonly showErrors = signal(false);
  // The tab bodies render through NDBX's portal and the app is zoneless:
  // the template reads this signal so every edit re-renders the open tab
  // and the totals, whatever view the change came from.
  private readonly version = signal(0);
  private readonly subTypeOptions = new Map(
    RESERVE_TYPES.map(t => [t, this.lookupSvc.getReserveSubTypesForSync(t).map(o => o.label)])
  );

  constructor() {
    // Opens on the reserve type picked in Add reserve, ready to type into.
    if (!this.lines(this.data.tab).length) this.add(this.data.tab);
  }

  lines(type: ReserveType): SubReserve[] {
    this.version();
    return this.item.subReserves[type] ?? [];
  }
  subTypes(type: ReserveType): string[] {
    return this.subTypeOptions.get(type) ?? [];
  }
  total(type: ReserveType): number {
    this.version();
    return this.line.subAmounts?.[type] ?? 0;
  }
  get netTotal(): number {
    this.version();
    return this.line.amount;
  }

  add(type: ReserveType): void {
    this.item.subReserves[type] = [
      ...this.lines(type),
      this.claimsSvc.blankSubReserve(this.line, type)
    ];
    this.version.update(v => v + 1);
  }

  remove(type: ReserveType, id: string): void {
    this.item.subReserves[type] = this.lines(type).filter(l => l.subReserveId !== id);
    applyReserveTotals(this.line);
    this.version.update(v => v + 1);
  }

  change(type: ReserveType, { id, patch }: ReserveLineChange): void {
    this.item.subReserves[type] = this.lines(type).map(l =>
      l.subReserveId === id ? { ...l, ...patch } : l
    );
    applyReserveTotals(this.line);
    this.version.update(v => v + 1);
  }

  @HostListener('keydown.escape')
  done(): void {
    const invalid = this.types.findIndex(t => this.lines(t).some(l => l.amount > 0 && !l.subType));
    if (invalid >= 0) {
      this.showErrors.set(true);
      this.tabIndex.set(invalid);
      return;
    }
    this.ref.close(true);
  }
}
