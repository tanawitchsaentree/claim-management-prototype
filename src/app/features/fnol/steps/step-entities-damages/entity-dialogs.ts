import { NxDialogService } from '@allianz/ng-aquila/modal';
import { firstValueFrom } from 'rxjs';
import { EntityRow, EntitySearchResult, EntityType } from '../../../../core/models';
import { EntitySearchModalComponent } from '../../components/entity-search-modal/entity-search-modal.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  MoveEntityDialogComponent,
  MoveEntityDialogData,
  MoveEntityResult
} from '../../components/move-entity-dialog/move-entity-dialog.component';

/** The dialogs the Entities & Damages step opens, each returning what the handler chose. */

export async function pickEntities(
  dialog: NxDialogService,
  policyNumber: string,
  entityType: EntityType,
  rule?: EntityRow
): Promise<EntitySearchResult[] | undefined> {
  const ref = dialog.open<EntitySearchModalComponent, unknown, EntitySearchResult[]>(
    EntitySearchModalComponent,
    {
      data: { policyNumber, entityType, initialFilters: rule?.ruleFilters },
      width: '900px',
      maxWidth: '95vw'
    }
  );
  return firstValueFrom(ref.afterClosed());
}

export async function askMove(
  dialog: NxDialogService,
  entity: EntityRow
): Promise<MoveEntityResult | null | undefined> {
  const data: MoveEntityDialogData = {
    entity,
    currentSection: entity.promiseStatus,
    currentGroupKey: entity.damageTypeKey ?? 'material-damage'
  };
  const ref = dialog.open<MoveEntityDialogComponent, MoveEntityDialogData, MoveEntityResult | null>(
    MoveEntityDialogComponent,
    { data, width: '480px' }
  );
  return firstValueFrom(ref.afterClosed());
}

export async function confirmRemove(dialog: NxDialogService, entity: EntityRow): Promise<boolean> {
  const data: ConfirmDialogData = {
    title: 'Remove entity',
    message: `Remove "${entity.name}" from the list?`,
    confirmLabel: 'Remove',
    confirmDanger: true
  };
  const ref = dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
    ConfirmDialogComponent,
    { data, width: '480px' }
  );
  return !!(await firstValueFrom(ref.afterClosed()));
}

export function warnSelectEntity(dialog: NxDialogService): void {
  const data: ConfirmDialogData = {
    title: 'Select an entity',
    message: 'Select at least one entity that was damaged before continuing.',
    confirmLabel: 'Got it',
    cancelLabel: 'Close'
  };
  dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
    data,
    width: '480px'
  });
}
