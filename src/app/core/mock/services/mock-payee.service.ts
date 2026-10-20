import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { Payee } from '../../models/payee.model';
import payeesData from '../data/payees.json';

// Make payment, accordion 1. Kept separate from parties.json (claim-level
// party records the Parties page uses): a payee here carries what payment
// needs (bank accounts, sanctions clearance, GG Name Code). The four seeds
// for CLM-2024-001 cover: ready to pay (PY-001 / PY-002), no GG Name Code
// (PY-003), sanctions clearance pending (PY-004), and a non-operational bank
// account (PY-001 / BA-002).
@Injectable({ providedIn: 'root' })
export class MockPayeeService extends MockBaseService {
  private readonly data = payeesData as Record<string, Payee[]>;

  getPayees(claimId: string): Observable<Payee[]> {
    return this.list(this.data[claimId] ?? []);
  }

  getPayeesSync(claimId: string): Payee[] {
    return this.data[claimId] ?? [];
  }
}
