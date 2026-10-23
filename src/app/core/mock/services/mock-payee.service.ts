import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Payee, PayeeClearance } from '../../models/payee.model';
import { Party } from '../../models/party.model';
import { MockPartiesService } from './mock-parties.service';

// Make payment's payee list is the claim's own parties (parties.json, the
// same store FNOL and Litigation use), not a separate list: a payee is a
// party plus where it can be paid (bankAccounts) and its GG Name Code.
// CLM-2024-001's parties are the people its payments and reserves already
// name. Test cases: Elke Dorn's Commerzbank account is no longer operational
// (matches payment 123456-4's bank-details failure), Georg Stein has no GG
// Name Code, Carlo Clerk's sanctions clearance is pending.
@Injectable({ providedIn: 'root' })
export class MockPayeeService {
  private readonly partiesSvc = inject(MockPartiesService);

  getPayees(claimId: string): Observable<Payee[]> {
    return of(this.getPayeesSync(claimId)).pipe(delay(0));
  }

  getPayeesSync(claimId: string): Payee[] {
    return this.partiesSvc.getPartiesForClaimSync(claimId).map(toPayee);
  }
}

const ROLE_LABEL: Record<string, string> = {
  insured: 'Insured',
  client: 'Client',
  claimant: 'Claimant',
  'third-party': 'Third party',
  expert: 'Expert / loss adjuster',
  broker: 'Broker',
  witness: 'Witness',
  authority: 'Authority'
};

function toPayee(p: Party): Payee {
  const clearance: PayeeClearance = p.clearanceStatus === 'cleared' ? 'cleared' : 'pending';
  const street = [p.street, p.streetNumber].filter(Boolean).join(' ');
  return {
    payeeId: p.partyId,
    name: p.legalName,
    role: p.roles.map(r => ROLE_LABEL[r] ?? r).join(', '),
    address: [street, [p.postalCode, p.city].filter(Boolean).join(' '), p.country].filter(Boolean).join(', '),
    email: p.email,
    phone: p.phone,
    landline: p.landline,
    otherAddresses: p.otherAddresses,
    emails: p.email ? [{ address: p.email, preferred: true }] : [],
    clearance,
    ggNameCode: p.ggNameCode,
    bankAccounts: p.bankAccounts ?? []
  };
}
