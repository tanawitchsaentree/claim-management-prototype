import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  NewRecoveryCase,
  RecoveryCase,
  RecoveryCaseFilters,
  RecoveryResolution,
  RecoveryRollup,
  rollupRecoveries,
} from '../../models/recovery.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';
import rawData from '../data/recovery-cases.json';

@Injectable({ providedIn: 'root' })
export class MockRecoveryService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  private cache: RecoveryCase[] = (rawData as unknown as RecoveryCase[]).map(c => this.clone(c));

  search(filters?: RecoveryCaseFilters): Observable<RecoveryCase[]> {
    let list = this.cache;
    if (filters?.claimId) list = list.filter(c => c.claimId === filters.claimId);
    if (filters?.status)  list = list.filter(c => c.status  === filters.status);
    return this.respond(list.map(c => this.clone(c)));
  }

  forClaim(claimId: string): RecoveryCase[] {
    return this.cache.filter(c => c.claimId === claimId).map(c => this.clone(c));
  }

  create(claimId: string, currency: string, owner: string, input: NewRecoveryCase): RecoveryCase {
    const fresh: RecoveryCase = {
      id:              this.nextId(),
      claimId,
      route:           input.route,
      counterparty:    input.counterparty,
      sectionRef:      input.sectionRef,
      currency,
      estimatedAmount: input.estimatedAmount,
      recoveredAmount: 0,
      // A new case is In progress, not Draft. The point of the Recoveries call
      // feedback is that "Yes" must turn into visible pursuit — parking it in a
      // Draft the handler has to remember to promote is the same dead end again.
      status:          'In progress',
      openedDate:      this.today(),
      expectedDate:    input.expectedDate,
      owner,
      note:            input.note,
    };
    this.cache = [fresh, ...this.cache];
    this.syncClaimFlags(claimId);
    return this.clone(fresh);
  }

  resolve(id: string, resolution: RecoveryResolution): RecoveryCase | null {
    const found = this.cache.find(c => c.id === id);
    if (!found) return null;
    const updated: RecoveryCase = {
      ...found,
      status:          resolution.status,
      recoveredAmount: resolution.status === 'Recovered' ? resolution.recoveredAmount : 0,
      outcomeNote:     resolution.outcomeNote,
      resolvedDate:    this.today(),
    };
    this.cache = this.cache.map(c => (c.id === id ? updated : c));
    this.syncClaimFlags(found.claimId);
    return this.clone(updated);
  }

  rollup(claimId: string): RecoveryRollup {
    return rollupRecoveries(this.cache.filter(c => c.claimId === claimId));
  }

  /**
   * Writes the claim-level flags back onto the overview record.
   *
   * The Overview card, the closure checklist and the dashboard prompt all read
   * `recoveryPotential` + `hasRecoveryCase` + `hasActiveRecovery` off the
   * overview, not off this list — so every mutation here has to push the
   * derived flags across or the three surfaces start disagreeing with the
   * recovery domain they are describing. patchOverview() no-ops when the claim
   * has no overview record yet, which is why the page loads the overview first.
   */
  syncClaimFlags(claimId: string): RecoveryRollup {
    const rollup = this.rollup(claimId);
    this.stateSvc.patchOverview(claimId, rollup);
    return rollup;
  }

  private nextId(): string {
    const used = this.cache
      .map(c => Number(/^REC-C-(\d+)$/.exec(c.id)?.[1] ?? 0))
      .filter(n => !Number.isNaN(n));
    const next = (used.length ? Math.max(...used) : 0) + 1;
    return `REC-C-${String(next).padStart(3, '0')}`;
  }

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
}
