import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PolicyLocation } from '../../models';
import { MockBaseService } from './mock-base.service';
import policyLocationsData from '../data/policy-locations.json';

@Injectable({ providedIn: 'root' })
export class MockPolicyLocationService extends MockBaseService {
  private readonly all = policyLocationsData as PolicyLocation[];

  getByPolicyNumber(policyNumber: string): Observable<PolicyLocation[]> {
    return this.respond(this.all.filter(l => l.policyNumber === policyNumber));
  }
}
