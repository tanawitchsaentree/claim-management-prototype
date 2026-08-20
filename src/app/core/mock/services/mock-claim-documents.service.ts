import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ClaimDocument } from '../../models/provider-communication.model';
import rawData from '../data/claim-documents.json';

@Injectable({ providedIn: 'root' })
export class MockClaimDocumentsService extends MockBaseService {
  private readonly data = rawData as unknown as ClaimDocument[];

  getByClaimId(claimId: string): Observable<ClaimDocument[]> {
    return this.list(this.data.filter(d => d.claimId === claimId));
  }
}
