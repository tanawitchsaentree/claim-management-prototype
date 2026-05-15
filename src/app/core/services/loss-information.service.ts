import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LossInformation, LossInformationFormValue } from '../models/loss-information.model';
import { MockLossInformationService } from '../mock/services/mock-loss-information.service';

@Injectable({ providedIn: 'root' })
export class LossInformationService {
  private mock = inject(MockLossInformationService);

  getById(id: string): Observable<LossInformation> {
    return this.mock.getById(id);
  }

  getByClaimId(claimId: string): Observable<LossInformation | null> {
    return this.mock.getByClaimId(claimId);
  }

  save(data: LossInformationFormValue): Observable<{ id: string }> {
    return this.mock.save(data);
  }
}
