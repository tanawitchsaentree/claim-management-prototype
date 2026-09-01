import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LossInformation, LossInformationFormValue, LossLocation } from '../../models/loss-information.model';
import { Claim } from '../../models/claim.model';
import { LocationPickerOutput } from '../../models/location-picker.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import { MockClaimService } from './mock-claim.service';

// No time of day is stored anywhere on Claim, but FNOL requires both times, so
// a claim file cannot exist without them. A synthesized record reuses the same
// placeholders FnolStateService.prefillFullFromSkeleton uses rather than null:
// null leaves the edit form invalid with the error hidden inside a collapsed
// field group, i.e. a Save button that refuses with nothing on screen to fix.
const SYNTH_TIME_OF_OCCURRENCE  = '09:00';
const SYNTH_TIME_OF_NOTIFICATION = '10:00';

@Injectable({ providedIn: 'root' })
export class MockLossInformationService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
  private readonly claimSvc = inject(MockClaimService);
  private get records() { return this.stateSvc.state().lossInformation; }

  getAll(): Observable<LossInformation[]> {
    return this.list(this.records);
  }

  getById(id: string): Observable<LossInformation> {
    return this.findById(
      this.records as unknown as Record<string, unknown>[],
      'id',
      id
    ) as unknown as Observable<LossInformation>;
  }

  getByClaimId(claimId: string): Observable<LossInformation | null> {
    const found = this.records.find(r => r.claimId === claimId);
    if (found) return this.respond(found);

    // loss-information.json hand-authors records for 5 of the 27 claims in
    // claims.json — yet every entry in that list is a claim file, and a claim
    // file only exists because FNOL captured loss information for it. Returning
    // null for the other 22 left "Edit claim details" rendering every field as
    // "Not provided" with its Save button permanently disabled (the form diffs
    // against `original`, which stayed null, so there were never any pending
    // changes to save). Synthesize the record from the Claim, the same way
    // MockClaimOverviewService.synthesizeOverviewFromClaim does for the
    // overview, and persist it so save() updates that record instead of
    // appending a second one for the same claim.
    return this.claimSvc.getById(claimId).pipe(
      map(claim => this.synthesizeFromClaim(claim)),
      tap(record => this.ensureRecord(record)),
      // Genuinely unknown claimId (not in claims.json) — nothing to synthesize
      // from, so the caller still gets null and shows its empty state.
      catchError(() => this.respond<LossInformation | null>(null)),
    );
  }

  save(data: LossInformationFormValue, claimId?: string): Observable<{ id: string }> {
    const now = new Date().toISOString();
    const existing = claimId ? this.records.find(r => r.claimId === claimId) : null;

    if (existing) {
      const updated: LossInformation = {
        ...existing,
        ...data,
        updatedAt: now,
      };
      this.stateSvc.patchLossInformation(items =>
        items.map(r => r.id === existing.id ? updated : r)
      );
      return this.respond({ id: existing.id });
    }

    const id = `LI-${Date.now()}`;
    const newRecord: LossInformation = {
      ...data,
      id,
      claimId: claimId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.stateSvc.patchLossInformation(items => [...items, newRecord]);
    return this.respond({ id });
  }

  /** Idempotent insert — mirrors MockStateService.ensureOverview for this list. */
  private ensureRecord(record: LossInformation): void {
    this.stateSvc.patchLossInformation(items =>
      items.some(r => r.claimId === record.claimId) ? items : [...items, record]
    );
  }

  private synthesizeFromClaim(claim: Claim): LossInformation {
    const now      = new Date().toISOString();
    const city     = claim.location?.city ?? '';
    const country  = claim.location?.country ?? '';
    // The seeded records store lossLocation in the location-picker's shape
    // ({ locations: [...] }), not the stale LossLocation interface — follow the
    // data, which is what the picker and the edit screen actually read.
    const lossLocation: LocationPickerOutput = {
      locations: city || country ? [{
        id:           `loc-${claim.claimId}`,
        source:       'policy',
        displayName:  [claim.clientName, city].filter(Boolean).join(' — '),
        addressLine1: '',
        postalCode:   '',
        city,
        country,
      }] : [],
    };

    return {
      id:      `LI-${claim.claimId}`,
      claimId: claim.claimId,
      dateOfLoss: {
        dateOfOccurrence:   claim.lossDate ?? null,
        timeOfOccurrence:   SYNTH_TIME_OF_OCCURRENCE,
        // The claim was created off the notification, so its creation date is
        // the closest thing to a notification date the Claim record carries.
        dateOfNotification: claim.dateCreated ?? claim.lossDate ?? null,
        timeOfNotification: SYNTH_TIME_OF_NOTIFICATION,
      },
      lossLocation: lossLocation as unknown as LossLocation,
      // Only 2 of 27 claims carry causeOfLoss and none carries typeOfDamage —
      // left empty rather than guessed, so the edit screen opens on the field
      // the handler has to fill (prefillForm's editingField logic).
      causeOfLoss:     claim.causeOfLoss ?? [],
      typeOfDamage:    [],
      lossDescription: claim.description ?? '',
      events:          [],
      createdAt: claim.dateCreated ? `${claim.dateCreated}T00:00:00Z` : now,
      updatedAt: now,
    };
  }
}
