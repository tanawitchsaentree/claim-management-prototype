import { Injectable, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FnolStateService } from '../../../core/services/fnol-state.service';
import { MockClaimService } from '../../../core/mock/services/mock-claim.service';
import { MockPartiesService } from '../../../core/mock/services/mock-parties.service';
import { MockStateService } from '../../../core/mock/state/mock-state.service';
import { Claim } from '../../../core/models';
import { Party } from '../../../core/models/party.model';
import { FnolSelectedClient, SkeletonFormValue } from '../models/fnol-form.model';

export type SkeletonStepKey = 'skeleton-create' | 'skeleton-parties' | 'skeleton-summary';

/** Query param that carries the journey's claim number between steps and across a reload. */
export const SKELETON_CLAIM_PARAM = 'claimNumber';

/** Reason written on a skeleton claim closed by Cancel (BMPCC-18525 AC-3). */
export const CANCELLED_BY_USER = 'cancelled by user';

// BMPCC-20759: skeleton journey state lives under skeleton:<claimNumber>, the
// claim number being the only identifier. FNOL keeps its own FNOL:* keys; this
// service only ever reads, writes or removes keys with the skeleton: prefix.
const KEY_PREFIX = 'skeleton:';

interface LossEventValue {
  eventKey: string;
  damages?: string[];
  causedBy?: string[];
}

export interface SkeletonJourneyState {
  claimNumber: string;
  currentStep: SkeletonStepKey;
  completedSteps: string[];
  skeleton: SkeletonFormValue;
  selectedClient: FnolSelectedClient | null;
  lossInformation: Record<string, unknown>;
  parties: Party[];
  savedAt: string;
}

/**
 * Owns the skeleton (orphan) claim journey: the claim is created once, on the
 * first Next from Loss information, and every later Next updates that same
 * claim (BMPCC-18525 AC-1/AC-2). Cancel closes it as "cancelled by user"
 * (AC-3), and the journey is saved to / restored from local storage so a
 * reload keeps the handler on the same step (AC-6, BMPCC-20759).
 */
@Injectable({ providedIn: 'root' })
export class SkeletonJourneyService {
  private readonly fnolState = inject(FnolStateService);
  private readonly claimSvc = inject(MockClaimService);
  private readonly partiesSvc = inject(MockPartiesService);
  private readonly stateSvc = inject(MockStateService);

  private inFlight: Promise<string> | null = null;

  static keyFor(claimNumber: string): string {
    return `${KEY_PREFIX}${claimNumber}`;
  }

  get claimNumber(): string | null {
    return this.fnolState.skeletonClaimId || null;
  }

  /** Query params to carry on every skeleton step link once the claim exists. */
  queryParams(): Record<string, string> {
    const id = this.claimNumber;
    return id ? { [SKELETON_CLAIM_PARAM]: id } : {};
  }

  // ── Claim: create once, then update ────────────────────────────────

  /**
   * Creates the skeleton claim on the first call of a journey and updates it on
   * every later one. Concurrent calls (double-click on Next) share one request.
   */
  upsertClaim(): Promise<string> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.doUpsert().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  private async doUpsert(): Promise<string> {
    const payload = this.claimPayload();
    const existingId = this.claimNumber;
    if (existingId && this.claimExists(existingId)) {
      await firstValueFrom(this.claimSvc.update(existingId, payload));
      return existingId;
    }
    const created = await firstValueFrom(
      this.claimSvc.create(
        {
          ...payload,
          policyNumber: '',
          assignee: null,
          createdBy: 'Current User',
          lossAmount: 0,
          currency: 'EUR',
          // 'Open' from creation: a skeleton is already a claim (BMPCC-17927
          // functional review, 2026-09-22); skeletonState carries the stage.
          status: 'Open',
          skeletonState: 'awaiting-policy',
          priority: 'medium',
          lineOfBusiness: 'Property',
          lossEventId: null,
          claimType: 'skeleton',
          slaDeadlineDays: 3
        } as Omit<Claim, 'claimId' | 'dateCreated'>,
        'SK'
      )
    );
    this.fnolState.skeletonClaimId = created.claimId;
    return created.claimId;
  }

  /** The claim fields Loss information owns, written on create and on every update. */
  claimPayload(): Partial<Claim> {
    const draft = this.fnolState.skeleton;
    const li = this.lossInformationValue();
    const dol = (li['dateOfLoss'] as { dateOfOccurrence?: string | null } | null) ?? {};
    const locs = (li['lossLocation'] as { locations?: { city?: string; country?: string }[] } | null)
      ?.locations;
    const first = locs?.[0];
    return {
      clientName: draft?.clientName ?? '',
      broker: draft?.brokerName ?? null,
      skeletonReason: draft?.reason,
      dateUpdated: new Date().toISOString().split('T')[0],
      lossDate: dol.dateOfOccurrence ?? '',
      description: (li['lossDescription'] as string) || draft?.notes || '',
      causeOfLoss: (li['causeOfLoss'] as string[]) ?? [],
      location: first ? { city: first.city ?? '', country: first.country ?? '' } : null
    };
  }

  /**
   * Cancel (BMPCC-18525 AC-3/AC-4): closes the journey's claim with reason
   * "cancelled by user", then clears the journey. Throws if closing fails, so
   * the caller can show an error and keep the handler on the page.
   */
  async cancel(): Promise<void> {
    const id = this.claimNumber;
    if (id && this.claimExists(id)) {
      await firstValueFrom(this.claimSvc.closeCancelledSkeleton(id, CANCELLED_BY_USER));
    }
    this.clear();
  }

  // ── Local storage ──────────────────────────────────────────────────

  /** Saves the journey under skeleton:<claimNumber>. No-op before the claim exists. */
  save(currentStep: SkeletonStepKey, parties?: Party[]): void {
    const id = this.claimNumber;
    const skeleton = this.fnolState.skeleton;
    if (!id || !skeleton) return;
    const previous = this.read(id);
    const state: SkeletonJourneyState = {
      claimNumber: id,
      currentStep,
      completedSteps: [...this.fnolState.completedSteps],
      skeleton,
      selectedClient: this.fnolState.selectedClient,
      lossInformation: this.lossInformationValue(),
      parties: parties ?? previous?.parties ?? [],
      savedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SkeletonJourneyService.keyFor(id), JSON.stringify(state));
    } catch {
      // storage full / unavailable: the journey still works, it just won't survive a reload
    }
  }

  /**
   * After a reload the in-memory journey is gone: rebuild it from
   * skeleton:<claimNumber>. Returns false when there is nothing to restore
   * (no key, or its claim no longer exists in this session's mock data).
   */
  restore(claimNumber: string | null): boolean {
    if (this.fnolState.skeleton) return true;
    if (!claimNumber) return false;
    const state = this.read(claimNumber);
    if (!state) return false;
    if (!this.claimExists(claimNumber)) {
      localStorage.removeItem(SkeletonJourneyService.keyFor(claimNumber));
      return false;
    }
    this.fnolState.path = 'orphan';
    this.fnolState.selectedClient = state.selectedClient;
    this.fnolState.setSkeleton(state.skeleton, state.claimNumber);
    this.fnolState.completedSteps.clear();
    state.completedSteps.forEach(s => this.fnolState.markStepComplete(s));
    this.restoreLossInformation(state.lossInformation);
    this.partiesSvc.setOrphanParties(state.parties ?? []);
    return true;
  }

  /**
   * A new journey from FNOL search always starts clean, even if an earlier one
   * was left by navigating away (its saved key is left alone, not resumed).
   */
  startNew(): void {
    this.fnolState.getStepGroup('lossInformation').reset();
    this.fnolState.getLossEventsArray().clear();
    this.fnolState.completedSteps.clear();
    this.fnolState.skeleton = null;
    this.fnolState.skeletonClaimId = null;
    this.partiesSvc.resetOrphanParties();
    this.inFlight = null;
  }

  /** Ends the journey (cancel or completion, AC-7): removes its key and resets state. */
  clear(): void {
    const id = this.claimNumber;
    if (id) localStorage.removeItem(SkeletonJourneyService.keyFor(id));
    this.partiesSvc.resetOrphanParties();
    this.fnolState.reset();
    this.inFlight = null;
  }

  private read(claimNumber: string): SkeletonJourneyState | null {
    try {
      const raw = localStorage.getItem(SkeletonJourneyService.keyFor(claimNumber));
      return raw ? (JSON.parse(raw) as SkeletonJourneyState) : null;
    } catch {
      return null;
    }
  }

  private claimExists(claimId: string): boolean {
    return this.stateSvc.state().claims.some(c => c.claimId === claimId);
  }

  private lossInformationValue(): Record<string, unknown> {
    return (this.fnolState.fnolForm.get('lossInformation')?.getRawValue() as Record<string, unknown>) ?? {};
  }

  // Same rebuild prefillFromExistingLossInfo() does: the events FormArray holds
  // one group per cause, so it is rebuilt before the rest is patched in.
  private restoreLossInformation(value: Record<string, unknown>): void {
    const events = this.fnolState.getLossEventsArray();
    events.clear();
    ((value['events'] as LossEventValue[]) ?? []).forEach(ev => {
      events.push(
        new FormGroup({
          eventKey: new FormControl(ev.eventKey),
          damages: new FormControl<string[]>(ev.damages ?? [], [Validators.required]),
          ...(ev.causedBy ? { causedBy: new FormControl<string[]>(ev.causedBy) } : {})
        })
      );
    });
    const rest = { ...value };
    delete rest['events'];
    this.fnolState.getStepGroup('lossInformation').patchValue(rest);
  }
}
