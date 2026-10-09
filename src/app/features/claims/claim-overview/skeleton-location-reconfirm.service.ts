import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import {
  AddLocationModalComponent,
  AddLocationModalData
} from '../../../shared/components/add-location-modal/add-location-modal.component';
import { MockPolicyLocationService } from '../../../core/mock/services/mock-policy-location.service';
import { MockTaskService } from '../../../core/mock/services/mock-task.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import {
  AddLocationModalResult,
  LocationItem,
  LocationPickerOutput,
  PolicyLocation
} from '../../../core/models';

/**
 * Right after Link policy, a Location of loss typed in at skeleton stage (never
 * checked against Location Manager) is swapped for the policy's real one.
 * Opens AddLocationModal in its policy-only reconfirm mode: closest match first. Anything the handler skips
 * stays covered by the "Confirm loss location" task convertToRegularClaim makes.
 */
@Injectable({ providedIn: 'root' })
export class SkeletonLocationReconfirmService {
  private readonly dialogSvc = inject(NxDialogService);
  private readonly policyLocationSvc = inject(MockPolicyLocationService);
  private readonly taskSvc = inject(MockTaskService);
  private readonly stateSvc = inject(MockStateService);

  /** Resolves true when the location was replaced (and its follow-up task closed). */
  async run(claimId: string, policyNumber: string): Promise<boolean> {
    const oldItems = this.currentLocations(claimId);
    if (!oldItems.length) return false;

    const policyLocations = (
      await firstValueFrom(this.policyLocationSvc.getByPolicyNumber(policyNumber))
    ).filter(l => l.active);
    if (!policyLocations.length) return false;

    const ref = this.dialogSvc.open<
      AddLocationModalComponent,
      AddLocationModalData,
      AddLocationModalResult | null
    >(AddLocationModalComponent, {
      data: { policyNumber, policyLocations, reconfirm: { original: oldItems } },
      showCloseIcon: true,
      panelClass: 'bottom-sheet-modal-panel'
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.policy.length) return false;
    const chosen = result.policy;

    this.writeLocations(claimId, chosen);
    await this.closeReconfirmTask(claimId);
    return true;
  }

  private currentLocations(claimId: string): LocationItem[] {
    const info = this.stateSvc.state().lossInformation.find(li => li.claimId === claimId);
    return (info?.lossLocation as unknown as LocationPickerOutput | undefined)?.locations ?? [];
  }

  private writeLocations(claimId: string, chosen: PolicyLocation[]): void {
    const locations: LocationItem[] = chosen.map(l => ({
      id: `loc-${Date.now()}-${l.id}`,
      source: 'policy',
      displayName: l.name,
      addressLine1: l.addressLine1,
      addressLine2: l.addressLine2,
      postalCode: l.postalCode,
      city: l.city,
      country: l.country,
      state: l.state,
      propertyId: l.propertyId,
      policyLocationRef: l.id
    }));
    this.stateSvc.patchLossInformation(items =>
      items.map(li =>
        li.claimId === claimId
          ? {
              ...li,
              lossLocation: { locations } as unknown as typeof li.lossLocation,
              updatedAt: new Date().toISOString()
            }
          : li
      )
    );
  }

  private async closeReconfirmTask(claimId: string): Promise<void> {
    const tasks = await firstValueFrom(this.taskSvc.getByClaimId(claimId));
    const task = tasks.find(
      t => t.status === 'open' && t.description.startsWith('Confirm loss location')
    );
    if (task) await firstValueFrom(this.taskSvc.update(task.taskId, { status: 'done' }));
  }
}
