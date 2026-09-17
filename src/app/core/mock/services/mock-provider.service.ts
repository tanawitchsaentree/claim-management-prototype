import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ProviderAssignment,
  ProviderAssignmentFilters,
  ProviderAssignmentStatus
} from '../../models/provider-assignment.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

@Injectable({ providedIn: 'root' })
export class MockProviderService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);

  search(filters?: ProviderAssignmentFilters): Observable<ProviderAssignment[]> {
    let list = this.stateSvc.state().providerAssignments;
    if (filters?.claimId) list = list.filter(a => a.claimId === filters.claimId);
    if (filters?.sectionId) list = list.filter(a => a.sectionId === filters.sectionId);
    if (filters?.providerType) list = list.filter(a => a.providerType === filters.providerType);
    if (filters?.status) list = list.filter(a => a.status === filters.status);
    return this.respond(structuredClone(list));
  }

  getActiveAssignmentsForClaim(claimId: string): Observable<ProviderAssignment[]> {
    const active = this.stateSvc
      .state()
      .providerAssignments.filter(a => a.claimId === claimId && a.status === 'Active');
    return this.respond(structuredClone(active));
  }

  // "Assign provider" — the Provider management page had no way to create an
  // assignment at all; "Instruct provider" on a Section just navigated here
  // with nothing to actually act on.
  create(
    input: Omit<ProviderAssignment, 'assignmentId'>
  ): Observable<ProviderAssignment> {
    const assignment: ProviderAssignment = { ...input, assignmentId: `PA-${Date.now()}` };
    this.stateSvc.appendProviderAssignments([assignment]);
    return this.respond(assignment);
  }

  updateStatus(assignmentId: string, status: ProviderAssignmentStatus): Observable<void> {
    this.stateSvc.patchProviderAssignment(assignmentId, { status });
    return this.respond(undefined as void);
  }

  // Reset already happens via MockStateService.resetAsync() setting the whole
  // state back to defaultState() (which re-seeds providerAssignments) — no
  // separate private cache here anymore. Kept as a no-op so that caller keeps
  // working without change.
  resetCache(): void {
    // intentionally empty
  }
}
