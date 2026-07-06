import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { ClaimOverview, ClaimActivity } from '../../models/claim-overview.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

@Injectable({ providedIn: 'root' })
export class MockClaimOverviewService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  getOverview(claimId: string): Observable<ClaimOverview> {
    const overviews = this.stateSvc.state().overviews;
    // Explicit null return when claimId not in mock data — callers should guard.
    // Fallback to CL-2025-001 only for the primary routed view (legacy behaviour).
    const item = overviews[claimId] ?? overviews['CL-2025-001'];
    return this.respond(item);
  }

  hasOverview(claimId: string): boolean {
    return claimId in this.stateSvc.state().overviews;
  }

  getActivities(claimId: string): Observable<ClaimActivity[]> {
    const activities = this.stateSvc.state().activities;
    const filtered = activities.filter(a => a.claimId === claimId);
    return this.list(filtered.length ? filtered : activities);
  }

  appendActivities(claimId: string, entries: ClaimActivity[]): void {
    this.stateSvc.patchActivities(existing => [...entries, ...existing]);
  }

  getOverviewWithActivities(claimId: string): Observable<{ claim: ClaimOverview; activities: ClaimActivity[] }> {
    return combineLatest({
      claim: this.getOverview(claimId),
      activities: this.getActivities(claimId),
    });
  }
}
