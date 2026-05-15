import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LossInformation, LossInformationFormValue } from '../../models/loss-information.model';
import { MockBaseService } from './mock-base.service';
import { MockStateService } from '../state/mock-state.service';

@Injectable({ providedIn: 'root' })
export class MockLossInformationService extends MockBaseService {
  private readonly stateSvc = inject(MockStateService);
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
    const found = this.records.find(r => r.claimId === claimId) ?? null;
    return this.respond(found);
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
      causeDetails: data.causeDetails ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.stateSvc.patchLossInformation(items => [...items, newRecord]);
    return this.respond({ id });
  }
}
