import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NxDialogService } from '@allianz/ng-aquila/modal';
import {
  AddLocationModalComponent,
  AddLocationModalData
} from '../components/add-location-modal/add-location-modal.component';
import { MockPolicyLocationService } from '../../core/mock/services/mock-policy-location.service';
import {
  AddLocationModalResult,
  LocationItem,
  LocationPickerOutput,
  PolicyLocation
} from '../../core/models';

/**
 * "Change location" in the Link policy step: opens the existing Add location
 * sheet for the chosen policy. With a location on the skeleton it opens in its
 * compare mode (closest policy location first, what differs); with none it opens
 * as the normal policy + manual sheet. Returns what was picked; nothing is
 * saved here (the conversion writes it).
 */
@Injectable({ providedIn: 'root' })
export class SkeletonLocationChoiceService {
  private readonly dialogSvc = inject(NxDialogService);
  private readonly policyLocationSvc = inject(MockPolicyLocationService);

  async choose(
    policyNumber: string,
    original: LocationItem[],
    lineOfBusiness?: { claim?: string; policy?: string }
  ): Promise<LocationPickerOutput | null> {
    const all = await firstValueFrom(this.policyLocationSvc.getByPolicyNumber(policyNumber));
    const policyLocations: PolicyLocation[] = all.filter(l => l.active);
    const ref = this.dialogSvc.open<AddLocationModalComponent, AddLocationModalData, AddLocationModalResult | null>(
      AddLocationModalComponent,
      {
        data: {
          policyNumber,
          policyLocations,
          ...(original.length
            ? {
                reconfirm: {
                  original,
                  claimLineOfBusiness: lineOfBusiness?.claim,
                  policyLineOfBusiness: lineOfBusiness?.policy
                }
              }
            : {})
        },
        showCloseIcon: false,
        panelClass: 'bottom-sheet-modal-panel'
      }
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return null;
    const id = (): string => 'loc-' + Math.random().toString(36).slice(2, 9);
    const locations: LocationItem[] = [
      ...result.policy.map(
        (l): LocationItem => ({
          id: id(),
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
        })
      ),
      ...result.manual.map(
        (m): LocationItem => ({
          id: id(),
          source: 'manual',
          displayName: m.streetAndNumber,
          addressLine1: m.streetAndNumber,
          addressLine2: m.addressLine2,
          postalCode: m.postalCode,
          city: m.city,
          country: m.country,
          state: m.state,
          additionalInfo: m.notes
        })
      )
    ];
    return locations.length ? { locations: locations.slice(0, 1) } : null;
  }
}
