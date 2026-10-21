import { selectedSectionGroups } from '../../../../shared/components/entities-selection/selected-section-groups';
import {
  Component,
  computed,
  effect,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  signal
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, firstValueFrom } from 'rxjs';
import { NxSpinnerModule } from '@allianz/ng-aquila/spinner';
import { NxButtonModule } from '@allianz/ng-aquila/button';
import { NxIconModule } from '@allianz/ng-aquila/icon';
import { NxMessageModule } from '@allianz/ng-aquila/message';
import { NxContextMenuModule } from '@allianz/ng-aquila/context-menu';
import { NxSwitcherModule } from '@allianz/ng-aquila/switcher';
import { NxModalModule, NxDialogService } from '@allianz/ng-aquila/modal';
import { FnolStateService } from '../../../../core/services/fnol-state.service';
import { MockEntitiesDamagesService } from '../../../../core/mock/services/mock-entities-damages.service';
import { MockLookupService } from '../../../../core/mock/services/mock-lookup.service';
import {
  EntitiesDamagesData,
  EntityRow,
  EntityType,
  SubItem,
  ENTITY_TYPE_LABELS
} from '../../../../core/models';
import { EntityDetailPanelComponent } from '../../components/entity-detail-panel/entity-detail-panel.component';
import {
  EntitiesFilterBarComponent,
  EntitySearchCriteria
} from '../../components/entities-filter-bar/entities-filter-bar.component';
import { EntitiesTableComponent } from '../../../../shared/components/entities-selection/entities-table/entities-table.component';
import { EntitiesTreePanelComponent } from '../../components/entities-tree-panel/entities-tree-panel.component';
import { askMove, confirmRemove, pickEntities, warnSelectEntity } from './entity-dialogs';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { WizardFooterComponent } from '../../../../shared/components/wizard-footer/wizard-footer.component';
import { ImpactedPoliciesBannerComponent } from '../../components/impacted-policies-banner/impacted-policies-banner.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import {
  EntityFilter,
  NO_FILTER,
  TreeGroup,
  buildTree,
  countEntities,
  seedEmptyGroups,
  setGroupExpanded,
  toggleEntity,
  toggleSubItem
} from '../../../../shared/components/entities-selection/entity-tree';

const EMPTY: EntitiesDamagesData = { sections: [] };

@Component({
  selector: 'app-step-entities-damages',
  standalone: true,
  imports: [
    NxSpinnerModule,
    NxButtonModule,
    NxIconModule,
    NxMessageModule,
    NxContextMenuModule,
    NxSwitcherModule,
    NxModalModule,
    EntityDetailPanelComponent,
    EntitiesFilterBarComponent,
    EntitiesTableComponent,
    EntitiesTreePanelComponent,
    WizardFooterComponent,
    ImpactedPoliciesBannerComponent,
    EmptyStateComponent
  ],
  templateUrl: './step-entities-damages.component.html',
  styleUrl: './step-entities-damages.component.scss'
})
export class StepEntitiesDamagesComponent implements OnInit, OnDestroy {
  private readonly fnolState = inject(FnolStateService);
  private readonly entitiesSvc = inject(MockEntitiesDamagesService);
  private readonly lookupSvc = inject(MockLookupService);
  private readonly router = inject(Router);
  private readonly dialog = inject(NxDialogService);
  private readonly toast = inject(ToastService);

  policyNumber = '';
  readonly entityTypes: EntityType[] = [
    'building',
    'vehicle',
    'marine',
    'employee',
    'financial',
    'other'
  ];
  readonly entityTypeLabels = ENTITY_TYPE_LABELS;

  get hasLossLocation(): boolean {
    return (this.fnolState.getLossLocationControl().value?.locations?.length ?? 0) > 0;
  }

  private readonly refresh$ = new Subject<void>();
  private readonly filter = signal<EntityFilter>(NO_FILTER);
  /** Ticks and expand/collapse change cached objects in place; this re-reads them. */
  private readonly rev = signal(0);
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  readonly vm = toSignal(this.refresh$.pipe(switchMap(() => this.load())), {
    initialValue: { data: EMPTY, loading: true, error: false }
  });
  readonly selectedOnly = computed(() => this.filter().selectedOnly);
  readonly groups = computed<TreeGroup[]>(() => {
    this.rev();
    return buildTree(this.vm().data, this.filter());
  });
  readonly entityCount = computed(() => countEntities(this.groups()));
  /** The entity whose details are open; the page shows list + details side by side. */
  readonly activeEntity = signal<EntityRow | null>(null);

  constructor() {
    effect(() => this.fnolState.stepperCompact.set(!!this.activeEntity()));
  }

  ngOnInit(): void {
    if (!this.fnolState.selectedPolicy && !this.fnolState.selectedClient) {
      this.router.navigate(['/fnol/search']);
      return;
    }
    this.policyNumber = this.fnolState.selectedPolicy?.policyNumber ?? '';
    this.refresh$.next();
  }

  /** Reads the cache and adds an empty group for each chosen type the policy has none for. */
  private load() {
    const types = (this.fnolState.fnolForm.get('lossInformation.typeOfDamage')?.value ??
      []) as string[];
    const labels = this.lookupSvc.getTypeOfDamageSync();
    const labelFor = (key: string) => labels.find(o => o.value === key)?.label ?? key;
    return this.entitiesSvc.getByPolicyId(this.policyNumber).pipe(
      map(data => ({ data: seedEmptyGroups(data, types, labelFor), loading: false, error: false })),
      catchError(() => of({ data: EMPTY, loading: false, error: true }))
    );
  }

  ngOnDestroy(): void {
    this.fnolState.stepperCompact.set(false);
    this.pendingTimeouts.forEach(id => clearTimeout(id));
  }

  bump(): void {
    this.rev.update(n => n + 1);
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  onSearch(c: EntitySearchCriteria): void {
    this.filter.update(f => ({ ...f, text: c.text, status: c.status }));
  }

  onResetSearch(): void {
    this.filter.update(f => ({ ...NO_FILTER, selectedOnly: f.selectedOnly }));
  }

  onSelectedOnly(on: boolean): void {
    this.filter.update(f => ({ ...f, selectedOnly: on }));
  }

  // ── Selection / expansion ──────────────────────────────────────────────────

  onEntityToggle(e: { entity: EntityRow; checked: boolean }): void {
    toggleEntity(e.entity, e.checked);
    this.bump();
  }

  onSubItemToggle(e: { entity: EntityRow; sub: SubItem; checked: boolean }): void {
    toggleSubItem(e.entity, e.sub, e.checked);
    this.bump();
  }

  onToggleGroup(group: TreeGroup): void {
    setGroupExpanded(group, !group.expanded);
    this.bump();
  }

  onToggleAll(expanded: boolean): void {
    this.groups().forEach(g => setGroupExpanded(g, expanded));
    this.bump();
  }

  onToggleRule(rule: EntityRow): void {
    rule.expanded = !rule.expanded;
    this.bump();
  }

  // ── Add entity ─────────────────────────────────────────────────────────────

  async onAddEntity(req: { type: EntityType; rule?: EntityRow }): Promise<void> {
    const selected = await pickEntities(this.dialog, this.policyNumber, req.type, req.rule);
    if (!selected?.length) return;
    let added: EntityRow[];
    try {
      added = await firstValueFrom(
        forkJoin(
          selected.map(r =>
            this.entitiesSvc.addEntityFromSearch(this.policyNumber, r, req.type, req.rule?.entityId)
          )
        )
      );
    } catch {
      this.toast.error('Failed to add entities', 'Please try again.');
      return;
    }
    if (req.rule) req.rule.expanded = true;
    this.refresh$.next();
    // Added entities arrive ticked; show the first one's details straight away.
    this.activeEntity.set(added[0]);
  }

  // ── Details panel ──────────────────────────────────────────────────────────

  onViewDetails(entity: EntityRow): void {
    this.activeEntity.set(entity);
  }

  onClosePanel(): void {
    this.activeEntity.set(null);
    this.scheduleClearHighlight();
  }

  onPoliciesAdded(): void {
    this.refresh$.next();
    this.scheduleClearHighlight();
  }

  /** Added rows stay highlighted for 3 seconds, then settle. */
  private scheduleClearHighlight(): void {
    this.pendingTimeouts.push(
      setTimeout(() => {
        this.vm()
          .data.sections.flatMap(s => s.damageGroups.flatMap(g => g.entities))
          .forEach(e => (e.recentlyAdded = false));
        this.bump();
      }, 3000)
    );
  }

  // ── Row actions ────────────────────────────────────────────────────────────

  async onMoveEntity(entity: EntityRow): Promise<void> {
    const result = await askMove(this.dialog, entity);
    if (!result) return;
    try {
      await firstValueFrom(
        this.entitiesSvc.moveEntity(
          this.policyNumber,
          entity.entityId,
          result.section,
          result.damageGroupKey
        )
      );
      this.refresh$.next();
    } catch {
      this.toast.error('Failed to move entity', 'Please try again.');
    }
  }

  async onRemoveEntity(entity: EntityRow): Promise<void> {
    if (!(await confirmRemove(this.dialog, entity))) return;
    try {
      await firstValueFrom(this.entitiesSvc.removeEntity(this.policyNumber, entity.entityId));
      this.refresh$.next();
    } catch {
      this.toast.error('Failed to remove entity', 'Please try again.');
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  onBack(): void {
    this.router.navigate(['/fnol/loss-information']);
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  async onNext(): Promise<void> {
    const data = await firstValueFrom(this.entitiesSvc.getByPolicyId(this.policyNumber));
    const selectedTypes = (this.fnolState.fnolForm.get('lossInformation.typeOfDamage')?.value ??
      []) as string[];
    if (!selectedSectionGroups(data, selectedTypes).size) {
      warnSelectEntity(this.dialog);
      return;
    }
    this.fnolState.markStepComplete('entities-damages');
    this.router.navigate(['/fnol/parties']);
  }
}
