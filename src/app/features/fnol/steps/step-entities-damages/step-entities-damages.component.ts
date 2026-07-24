import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxTableModule } from '@allianz/ng-aquila/table';
import { NxCheckboxModule } from '@allianz/ng-aquila/checkbox';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxFormfieldModule } from '@allianz/ng-aquila/formfield';
import { NxInputModule } from '@allianz/ng-aquila/input';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxTooltipModule } from '@allianz/ng-aquila/tooltip';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { NxPopoverModule } from '@allianz/ng-aquila/popover';
import { FnolStateService } from '../../services/fnol-state.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import {
  EntitiesDamagesData, DamageGroup, EntityRow, PromiseSection,
  SubItem, EntityType, EntitySearchResult, ENTITY_TYPE_LABELS, LocationLimit,
} from '../../../../core/models';
import { StatusChipComponent } from '../../../../shared/components/status-chip/status-chip.component';
import { EntityDetailPanelComponent } from '../../components/entity-detail-panel/entity-detail-panel.component';
import { EntitySearchModalComponent } from '../../components/entity-search-modal/entity-search-modal.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MoveEntityDialogComponent, MoveEntityDialogData, MoveEntityResult } from '../../components/move-entity-dialog/move-entity-dialog.component';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';

interface EntitiesDamagesVM {
  data: EntitiesDamagesData;
  loading: boolean;
  error: boolean;
}

const LIMIT_CAP = 3;

@Component({
  selector: 'app-step-entities-damages',
  standalone: true,
  animations: [
    trigger('rowsExpand', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('180ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('140ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' })),
      ]),
    ]),
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NxButtonModule,
    NxIconModule,
    NxSpinnerModule,
    NxTableModule,
    NxCheckboxModule,
    NxMessageModule,
    NxFormfieldModule,
    NxInputModule,
    NxContextMenuModule,
    NxTooltipModule,
    NxModalModule,
    NxPopoverModule,
    StatusChipComponent,
    EntityDetailPanelComponent,
    WizardFooterComponent,
  ],
  templateUrl: './step-entities-damages.component.html',
  styleUrl: './step-entities-damages.component.scss',
})
export class StepEntitiesDamagesComponent implements OnInit, OnDestroy {
  private readonly fnolState   = inject(FnolStateService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly router      = inject(Router);
  private readonly dialog      = inject(NxDialogService);

  policyNumber = '';

  get hasLossLocation(): boolean {
    return (this.fnolState.getLossLocationControl().value?.locations?.length ?? 0) > 0;
  }

  selectedEntity: EntityRow | null = null;
  panelOpen = false;
  private scrollLocked = false;

  readonly entityTypes: EntityType[] = ['building', 'vehicle', 'marine', 'employee', 'financial', 'other'];
  readonly entityTypeLabels = ENTITY_TYPE_LABELS;

  private readonly refresh$ = new BehaviorSubject<void>(undefined);
  vm$!: Observable<EntitiesDamagesVM>;

  ngOnInit(): void {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.policyNumber = this.fnolState.selectedPolicy?.policyNumber ?? '';
    this.vm$ = this.refresh$.pipe(
      switchMap(() =>
        this.entitiesSvc.getByPolicyId(this.policyNumber).pipe(
          map(data => ({ data, loading: false, error: false })),
          catchError(() => of({ data: { sections: [] } as EntitiesDamagesData, loading: false, error: true })),
        ),
      ),
    );
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  hasAnySelection(entity: EntityRow): boolean {
    if (!entity.subItems?.length) return entity.selected;
    return entity.subItems.some(s => s.selected);
  }

  isChecked(entity: EntityRow): boolean {
    if (!entity.subItems?.length) return entity.selected;
    return entity.subItems.every(s => s.selected);
  }

  isIndeterminate(entity: EntityRow): boolean {
    if (!entity.subItems?.length) return false;
    const n = entity.subItems.filter(s => s.selected).length;
    return n > 0 && n < entity.subItems.length;
  }

  // ── Limit list overflow ──────────────────────────────────────────────────────

  visibleLimits(entity: EntityRow): LocationLimit[] {
    return entity.limits?.slice(0, LIMIT_CAP) ?? [];
  }

  hiddenLimits(entity: EntityRow): LocationLimit[] {
    return entity.limits?.slice(LIMIT_CAP) ?? [];
  }

  onEntityToggle(entity: EntityRow, checked: boolean): void {
    if (!entity.subItems?.length) { entity.selected = checked; return; }
    entity.subItems.forEach(s => s.selected = checked);
    entity.selected = checked;
  }

  onSubItemToggle(entity: EntityRow, subItem: SubItem, checked: boolean): void {
    subItem.selected = checked;
    entity.selected = entity.subItems!.every(s => s.selected);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  filteredEntities(group: DamageGroup): EntityRow[] {
    return group.entities;
  }

  toggleSection(section: PromiseSection): void { section.expanded = !section.expanded; }
  toggleGroup(group: DamageGroup): void         { group.expanded   = !group.expanded;   }

  totalEntities(data: EntitiesDamagesData): number {
    return data.sections.flatMap(s => s.damageGroups.flatMap(g => g.entities)).length;
  }

  // ── Add Entity ─────────────────────────────────────────────────────────────

  async openSearchModal(entityType: EntityType): Promise<void> {
    const ref = this.dialog.open<EntitySearchModalComponent, unknown, EntitySearchResult[]>(
      EntitySearchModalComponent,
      { data: { policyNumber: this.policyNumber, entityType }, width: '900px', maxWidth: '95vw' },
    );
    const selected = await firstValueFrom(ref.afterClosed());
    if (selected?.length) this.addEntitiesToList(selected, entityType);
  }

  private async addEntitiesToList(selected: EntitySearchResult[], entityType: EntityType): Promise<void> {
    const added = await firstValueFrom(
      forkJoin(selected.map(r => this.entitiesSvc.addEntityFromSearch(this.policyNumber, r, entityType))),
    );
    this.refresh$.next();

    setTimeout(() => {
      const firstId = added[0]?.entityId;
      if (firstId) {
        document.querySelector(`[data-entity-id="${firstId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);

    if (added.length > 0) {
      setTimeout(() => this.onViewDetails(added[0]), 300);
    }

    setTimeout(() => {
      added.forEach(e => { e.recentlyAdded = false; });
      this.refresh$.next();
    }, 3000);
  }

  // ── Entity row kebab actions ───────────────────────────────────────────────

  onViewDetails(entity: EntityRow): void {
    this.selectedEntity = entity;
    this.panelOpen = true;
    this.lockScroll();
  }

  onClosePanel(): void {
    this.panelOpen = false;
    this.unlockScroll();
    setTimeout(() => { if (!this.panelOpen) this.selectedEntity = null; }, 300);
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  private lockScroll(): void {
    if (this.scrollLocked) return;
    document.body.style.overflow = 'hidden';
    this.scrollLocked = true;
  }

  private unlockScroll(): void {
    if (!this.scrollLocked) return;
    document.body.style.overflow = '';
    this.scrollLocked = false;
  }

  onItemSaved(): void {
    this.refresh$.next();
  }

  async onMoveEntity(entity: EntityRow): Promise<void> {
    const data: MoveEntityDialogData = {
      entity,
      currentSection:  entity.promiseStatus,
      currentGroupKey: entity.damageTypeKey ?? 'material-damage',
    };
    const ref = this.dialog.open<MoveEntityDialogComponent, MoveEntityDialogData, MoveEntityResult | null>(
      MoveEntityDialogComponent,
      { data, width: '480px' },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (result) {
      await firstValueFrom(
        this.entitiesSvc.moveEntity(this.policyNumber, entity.entityId, result.section, result.damageGroupKey),
      );
      this.refresh$.next();
    }
  }

  async onRemoveEntity(entity: EntityRow): Promise<void> {
    const dialogData: ConfirmDialogData = {
      title:        'Remove entity',
      message:      `Remove "${entity.name}" from the list?`,
      confirmLabel: 'Remove',
      confirmDanger: true,
    };
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data: dialogData, width: '480px' },
    );
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (confirmed) {
      await firstValueFrom(this.entitiesSvc.removeEntity(this.policyNumber, entity.entityId));
      this.refresh$.next();
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  onBack(): void   { this.router.navigate(['/fnol/loss-information']); }
  onCancel(): void { this.router.navigate(['/dashboard']); }
  onNext(): void {
    this.fnolState.markStepComplete('entities-damages');
    this.router.navigate(['/fnol/parties']);
  }
}
