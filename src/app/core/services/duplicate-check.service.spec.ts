import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DuplicateCheckService } from './duplicate-check.service';
import { MockStateService } from '../mock/state/mock-state.service';
import { Claim } from '../models';

// Real "input X → output Y" tests for the duplicate-claim matcher.
// A duplicate = same policyNumber + same lossDate (and overlapping cause, if given).
describe('DuplicateCheckService', () => {
  let service: DuplicateCheckService;
  let state: MockStateService;

  const claim = (over: Partial<Claim>): Claim => ({
    claimId: 'CLM-X', policyNumber: 'POL-1', clientName: 'ACME',
    broker: null, assignee: null, createdBy: 'tester',
    dateCreated: '2024-01-01', dateUpdated: '2024-01-01',
    lossDate: '2024-01-10', lossAmount: 1000, currency: 'EUR',
    description: '', status: 'Open', priority: 'medium',
    lineOfBusiness: 'Property', location: null, lossEventId: null,
    ...over,
  } as Claim);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DuplicateCheckService);
    state = TestBed.inject(MockStateService);
  });

  it('flags a claim with the same policy + loss date as a duplicate', async () => {
    state.patchClaims(() => [claim({ claimId: 'CLM-1', policyNumber: 'POL-9', lossDate: '2024-05-01' })]);
    const res = await firstValueFrom(service.checkDuplicates('POL-9', '2024-05-01'));
    expect(res.hasDuplicates).toBe(true);
    expect(res.duplicates.map(d => d.claimId)).toContain('CLM-1');
  });

  it('does NOT flag when the loss date differs', async () => {
    state.patchClaims(() => [claim({ claimId: 'CLM-1', policyNumber: 'POL-9', lossDate: '2024-05-01' })]);
    const res = await firstValueFrom(service.checkDuplicates('POL-9', '2024-12-31'));
    expect(res.hasDuplicates).toBe(false);
  });

  it('does NOT flag a different policy on the same date', async () => {
    state.patchClaims(() => [claim({ claimId: 'CLM-1', policyNumber: 'POL-9', lossDate: '2024-05-01' })]);
    const res = await firstValueFrom(service.checkDuplicates('POL-OTHER', '2024-05-01'));
    expect(res.hasDuplicates).toBe(false);
  });

  it('narrows by cause when provided (overlap matches)', async () => {
    state.patchClaims(() => [
      claim({ claimId: 'CLM-FIRE', policyNumber: 'POL-9', lossDate: '2024-05-01', causeOfLoss: ['fire'] }),
      claim({ claimId: 'CLM-WATER', policyNumber: 'POL-9', lossDate: '2024-05-01', causeOfLoss: ['water-damage'] }),
    ]);
    const res = await firstValueFrom(service.checkDuplicates('POL-9', '2024-05-01', ['fire']));
    const ids = res.duplicates.map(d => d.claimId);
    expect(ids).toContain('CLM-FIRE');
    expect(ids).not.toContain('CLM-WATER');
  });

  it('always includes legacy claims that have no stored cause', async () => {
    state.patchClaims(() => [claim({ claimId: 'CLM-LEGACY', policyNumber: 'POL-9', lossDate: '2024-05-01', causeOfLoss: [] })]);
    const res = await firstValueFrom(service.checkDuplicates('POL-9', '2024-05-01', ['fire']));
    expect(res.duplicates.map(d => d.claimId)).toContain('CLM-LEGACY');
  });
});
