import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, catchError } from 'rxjs/operators';
import { Claim } from '../models';
import { ACTIVE_SCENARIO } from '../mock/mock-config';
import { MockStateService } from '../mock/state/mock-state.service';

export interface DuplicateClaim {
  claimId: string;
  clientName: string;
  status: string;
  lossDate: string;
  lossAmount: number;
  currency: string;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: DuplicateClaim[];
}

@Injectable({ providedIn: 'root' })
export class DuplicateCheckService {
  private readonly stateSvc = inject(MockStateService);
  private get claims(): Claim[] {
    return this.stateSvc.state().claims;
  }

  // TODO [FNOL-DUP-1]: Confirm with product whether duplicate check should also
  // run at skeleton-claim creation stage (currently only on loss-information).
  //
  // PENDING [FNOL-DUP-5]: debounceTime(1000ms) and banner preview cap (3 items) are
  // hardcoded for MVP. Per-OE configurable parameters deferred post-MVP.

  checkDuplicates(
    policyNumber: string,
    dateOfOccurrence: string,
    causeOfLoss?: string[],
  ): Observable<DuplicateCheckResult> {
    let matches = this.claims.filter(c =>
      c.policyNumber === policyNumber &&
      c.lossDate === dateOfOccurrence
    );

    // When cause is provided, narrow to claims with overlapping causes.
    // A claim with no causeOfLoss stored is always included (legacy data).
    if (causeOfLoss && causeOfLoss.length > 0) {
      matches = matches.filter(c =>
        !c.causeOfLoss || c.causeOfLoss.length === 0 ||
        c.causeOfLoss.some(cause => causeOfLoss.includes(cause))
      );
    }

    const duplicates: DuplicateClaim[] = matches.map(c => ({
      claimId: c.claimId,
      clientName: c.clientName,
      status: c.status,
      lossDate: c.lossDate,
      lossAmount: c.lossAmount,
      currency: c.currency,
    }));

    return of({ hasDuplicates: duplicates.length > 0, duplicates }).pipe(
      delay(ACTIVE_SCENARIO.delayMs),
      // TODO [FNOL-DUP-2]: Replace with real API call when backend endpoint is available.
      // Silent fail is intentional — duplicate warning is advisory, not blocking.
      catchError(err => {
        console.warn('[DuplicateCheckService] Check failed — skipping warning', err);
        return of({ hasDuplicates: false, duplicates: [] });
      })
    );
  }
}
