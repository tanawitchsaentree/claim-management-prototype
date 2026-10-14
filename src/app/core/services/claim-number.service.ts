import { Injectable, inject } from '@angular/core';
import { MockStateService } from '../mock/state/mock-state.service';

/**
 * The number a person sees and quotes for a claim, versus the internal key.
 *
 * An orphan claim is born as SK-... and gets a regular claim number when a policy is
 * linked. The internal key (claimId) does not change, so nothing that points at it
 * (sections, tasks, reserves, documents, links) has to move; only what is shown changes.
 * The old SK- number is kept as a permanent alias.
 *
 * Everything here reads and writes mock state, so the dev banner's Reset puts the
 * claim back to SK- and the next number is worked out again from what exists.
 */
@Injectable({ providedIn: 'root' })
export class ClaimNumberService {
  private readonly stateSvc = inject(MockStateService);

  /** The number to show for a claim (its claimNumber, else its id). */
  displayFor(claimId: string | null | undefined): string {
    if (!claimId) return '';
    const c = this.stateSvc.state().claims.find(x => x.claimId === claimId);
    return c?.claimNumber ?? claimId;
  }

  /** Numbers the claim was known by before (e.g. its SK- number). */
  formerFor(claimId: string | null | undefined): string[] {
    if (!claimId) return [];
    return this.stateSvc.state().claims.find(x => x.claimId === claimId)?.formerClaimNumbers ?? [];
  }

  /** Internal key for an id, a claim number or a former number; null if unknown. */
  resolve(idOrNumber: string): string | null {
    const q = idOrNumber.trim().toLowerCase();
    const hit = this.stateSvc
      .state()
      .claims.find(
        c =>
          c.claimId.toLowerCase() === q ||
          c.claimNumber?.toLowerCase() === q ||
          (c.formerClaimNumbers ?? []).some(f => f.toLowerCase() === q)
      );
    return hit?.claimId ?? null;
  }

  /**
   * Gives the claim its regular claim number (idempotent: a second call returns the
   * same number). Returns { number, former } where former is the number it replaces.
   */
  assign(claimId: string): { number: string; former: string } {
    const existing = this.stateSvc.state().claims.find(c => c.claimId === claimId);
    if (existing?.claimNumber) return { number: existing.claimNumber, former: claimId };
    const number = this.next();
    this.stateSvc.patchClaims(claims =>
      claims.map(c =>
        c.claimId === claimId
          ? { ...c, claimNumber: number, formerClaimNumbers: [...(c.formerClaimNumbers ?? []), claimId] }
          : c
      )
    );
    return { number, former: claimId };
  }

  /** Next CLM-<year>-<seq>: one more than the highest already issued this year. */
  private next(): string {
    const year = new Date().getFullYear();
    const prefix = `CLM-${year}-`;
    const used = this.stateSvc
      .state()
      .claims.flatMap(c => [c.claimId, c.claimNumber ?? ''])
      .filter(n => n.startsWith(prefix))
      .map(n => parseInt(n.slice(prefix.length), 10))
      .filter(n => !Number.isNaN(n));
    const seq = (used.length ? Math.max(...used) : 0) + 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
