import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MockLossEventService } from './mock-loss-event.service';
import { LossEventOverview } from '../../models/loss-event-overview.model';

// The Loss Event Overview reads nothing of its own — every row on it is assembled
// here from loss-events.json + claims.json + parties.json + claim-documents.json.
// These gates cover the joins that silently produce an empty screen when a
// lossEventId stops matching: related claims, the CL-/CLM- party bridge, the
// per-currency roll-up, and the missing-event case.
describe('MockLossEventService', () => {
  let svc: MockLossEventService;

  const load = (id: string): Promise<LossEventOverview | null> =>
    firstValueFrom(svc.getOverview(id));

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [MockLossEventService] });
    svc = TestBed.inject(MockLossEventService);
  });

  it('returns null for an unknown loss event, so the page can show its not-found state', async () => {
    expect(await load('NOPE-999')).toBeNull();
  });

  it('carries the general-info block loss-events.json holds for the event', async () => {
    const ov = (await load('123456'))!;
    expect(ov.generalInfo.proximateCause).toEqual(['Fire']);
    expect(ov.generalInfo.eventOccurrenceTime).toBe('23:10');
    expect(ov.generalInfo.eventLocation).toContain('Bavaria');
    expect(ov.generalInfo.causesRelations.length).toBeGreaterThan(0);
    expect(ov.generalInfo.damagesCaused.map(d => d.type)).toContain('Material damage');
  });

  it('lists exactly the claims that point at the event, with handler and claimant', async () => {
    const ov = (await load('123456'))!;
    expect(ov.relatedClaims.map(c => c.claimId).sort())
      .toEqual(['CLM-2024-001', 'CLM-2024-011', 'CLM-2024-102']);
    const first = ov.relatedClaims.find(c => c.claimId === 'CLM-2024-001')!;
    expect(first.claimant).toBe("Kaufmann's Warehouse GmbH");
    expect(first.claimHandler).toBe('Georg Stein');
    expect(first.claimStatus).toBe('In progress');
  });

  it('agrees with the claimCount the loss events list shows', async () => {
    for (const id of ['123456', '345678', '910111', '101112', '111213', 'EVT-022', 'EVT-023']) {
      const ov = (await load(id))!;
      expect(ov.relatedClaims.length, `claimCount mismatch on ${id}`)
        .toBe(ov.summary.claimCount);
    }
  });

  // CLM-2024-005 pointed at loss event 111213, which had no record in
  // loss-events.json at all — the link rendered a dead page. Guards the repair.
  it('resolves loss event 111213, the one CLM-2024-005 links to', async () => {
    const ov = (await load('111213'))!;
    expect(ov.summary.name).toContain('Budapest');
    expect(ov.relatedClaims.map(c => c.claimId)).toEqual(['CLM-2024-005']);
  });

  // parties.json still keys its records as CL-2024-005 while claims.json uses
  // CLM-. Without the normalisation in collectParties() this table is always empty.
  it('bridges the CL-/CLM- claim id prefixes when collecting parties', async () => {
    const ov = (await load('111213'))!;
    expect(ov.parties.length).toBeGreaterThan(0);
    expect(ov.parties.map(p => p.partyName)).toContain('Kaufmann GmbH');
  });

  it('rolls reported loss up per currency rather than summing across them', async () => {
    const ov = (await load('345678'))!;
    const eur = ov.financials.totals.find(t => t.currency === 'EUR')!;
    expect(eur.claimCount).toBe(4);
    expect(eur.lossAmount).toBe(87500 + 760000 + 5500 + 3200);
    expect(ov.financials.totalReserve).toBe(ov.summary.totalReserve);
  });

  it('shows only documents belonging to the event\'s own claims', async () => {
    const withDocs = (await load('123456'))!;
    expect(withDocs.documents.length).toBe(3);
    expect(withDocs.documents.every(d => d.claimId === 'CLM-2024-001')).toBe(true);

    const withoutDocs = (await load('345678'))!;
    expect(withoutDocs.documents).toEqual([]);
  });
});
