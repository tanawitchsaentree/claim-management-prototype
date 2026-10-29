import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MockStateService } from '../mock/state/mock-state.service';
import { MockSectionService } from '../mock/services/mock-section.service';
import { MockClaimOverviewService } from '../mock/services/mock-claim-overview.service';
import { MockLookupService } from '../mock/services/mock-lookup.service';
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
  private readonly lookupSvc = inject(MockLookupService);

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
      const section = await firstValueFrom(
        this.sectionSvc.createSectionFromCauseOfLoss(claimId, v.causeOfLoss, this.locationLabel(first))
      );
      await this.shortenName(section, first);
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

  /**
   * The sections saving these changes will create, as damage-type labels: the claim's
   * first section when a cause is set on a claim with none, plus one for each Type of
   * damage that was added and has no section yet. Asked BEFORE saving so the confirm can
   * say so; a type that already has a section (open or closed) never gets a second one.
   */
  sectionsToCreate(
    claimId: string,
    changedLabels: string[],
    causeOfLoss: string[] | null | undefined,
    originalTypes: string[],
    newTypes: string[]
  ): string[] {
    const keys: string[] = [];
    if (this.willCreateFirstSection(claimId, changedLabels, causeOfLoss)) {
      keys.push(causeOfLoss!.includes('business-interruption') ? 'business-interruption' : 'material-damage');
    }
    const existing = new Set(this.sectionSvc.getByClaimIdSync(claimId).map(s => s.damageType));
    if (changedLabels.includes('Type of damages')) {
      for (const t of newTypes) {
        if (!originalTypes.includes(t) && !existing.has(t) && !keys.includes(t)) keys.push(t);
      }
    }
    const labels = this.lookupSvc.getTypeOfDamageSync();
    return keys.map(k => labels.find(o => o.value === k)?.label ?? k);
  }

  /**
   * Creates a section for each added Type of damage that still has none. Runs AFTER the
   * "Review needed" flagging, so a section made from the new values is not marked as
   * built from the old ones. Returns the names of the sections created.
   */
  async createSectionsForAddedTypes(
    claimId: string,
    v: LossInformationFormValue,
    originalTypes: string[]
  ): Promise<string[]> {
    const first = (v.lossLocation as unknown as LocationPickerOutput | null)?.locations?.[0];
    const created: string[] = [];
    for (const type of v.typeOfDamage ?? []) {
      if (originalTypes.includes(type)) continue;
      if (this.sectionSvc.getByClaimIdSync(claimId).some(s => s.damageType === type)) continue;
      const section = await firstValueFrom(
        this.sectionSvc.createSection(claimId, type, [{ name: this.locationLabel(first) }])
      );
      created.push(await this.shortenName(section, first));
    }
    return created;
  }

  /** The entity carries the full address; the section title only needs the city ("Bodily injury — Hamburg"). */
  private async shortenName(
    section: { id: string; name: string },
    loc: LocationPickerOutput['locations'][number] | undefined
  ): Promise<string> {
    const where = loc?.city || loc?.addressLine1;
    const label = section.name.split(' — ')[0];
    if (!where) return section.name;
    const name = `${label} — ${where}`;
    await firstValueFrom(this.sectionSvc.patchSection(section.id, { name }));
    return name;
  }

  /** The address as the Sections page shows it: street, city, country, postal code. */
  private locationLabel(loc: LocationPickerOutput['locations'][number] | undefined): string {
    const parts = [loc?.addressLine1, loc?.city, loc?.country, loc?.postalCode];
    return parts.filter(p => p && String(p).trim()).join(', ') || 'No location selected';
  }

  /** Names of the sections currently marked "Review needed". */
  reviewNeededSectionNames(claimId: string): string[] {
    return this.sectionSvc
      .getByClaimIdSync(claimId)
      .filter(s => s.status === 'Open' && s.reviewNeeded)
      .map(s => s.name);
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
