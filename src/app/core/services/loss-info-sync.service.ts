import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MockStateService } from '../mock/state/mock-state.service';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { LossInformationFormValue } from '../models/loss-information.model';
import { LocationPickerOutput } from '../models/location-picker.model';
import lookupsData from '../mock/data/lookups.json';

/**
 * What the rest of the claim does after Edit claim details saves.
 *
 * The loss-information record is only one of several copies of the same facts
 * (the claim record, the overview, the sections were all built from them). This
 * keeps those copies in step and, when the facts sections were built from have
 * changed, marks the open sections "Review needed" so the warning outlives the
 * moment of saving.
 */
@Injectable({ providedIn: 'root' })
export class LossInfoSyncService {
  private readonly stateSvc = inject(MockStateService);
  private readonly sectionSvc = inject(MockSectionService);
  private readonly overviewSvc = inject(MockClaimOverviewService);

  /** Claim record + overview location: the copies Edit used to leave stale. */
  async syncClaimCopies(
    claimId: string,
    v: LossInformationFormValue,
    changedLabels: string[]
  ): Promise<void> {
    const changed = (label: string): boolean => changedLabels.includes(label);
    const first = (v.lossLocation as unknown as LocationPickerOutput | null)?.locations?.[0];
    const location = first ? { country: this.countryCode(first.country), city: first.city } : null;

    this.stateSvc.patchClaims(claims =>
      claims.map(c =>
        c.claimId !== claimId
          ? c
          : {
              ...c,
              ...(changed('Cause of loss') ? { causeOfLoss: v.causeOfLoss ?? [] } : {}),
              ...(changed('Date of occurrence') && v.dateOfLoss?.dateOfOccurrence
                ? { lossDate: v.dateOfLoss.dateOfOccurrence }
                : {}),
              ...(changed('Loss description') ? { description: v.lossDescription ?? '' } : {}),
              ...(changed('Loss location') ? { location } : {})
            }
      )
    );
    // A claim with no sections (e.g. a skeleton made without a cause) gets its
    // first one the moment a cause is set: same rule as skeleton creation.
    if (this.willCreateFirstSection(claimId, changedLabels, v.causeOfLoss)) {
      await firstValueFrom(
        this.sectionSvc.createSectionFromCauseOfLoss(
          claimId,
          v.causeOfLoss,
          first?.city || first?.addressLine1 || 'Loss location'
        )
      );
    }
    if (changed('Loss location') && first) {
      await firstValueFrom(
        this.overviewSvc.updateGeneralInfo(claimId, {
          location: { street: first.addressLine1, ...location! }
        })
      );
    }
  }

  /** True when saving these changes creates the claim's first section (a cause is set on a claim with none). */
  willCreateFirstSection(claimId: string, changedLabels: string[], causeOfLoss?: string[] | null): boolean {
    return (
      changedLabels.includes('Cause of loss') &&
      !!causeOfLoss?.length &&
      this.sectionSvc.getByClaimIdSync(claimId).length === 0
    );
  }

  /** Marks every open section for review. Returns how many were marked. */
  flagSectionsForReview(claimId: string, changedLabels: string[]): number {
    return this.sectionSvc.flagOpenForReview(claimId, changedLabels);
  }

  private countryCode(country: string | undefined): string {
    if (!country) return '';
    const hit = lookupsData.countries.find(
      c => c.value === country || c.label.toLowerCase() === country.toLowerCase()
    );
    return hit?.value ?? country;
  }
}
