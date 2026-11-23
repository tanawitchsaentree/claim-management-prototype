import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  applyReserveTotals,
  Reserve,
  ReserveNarrative,
  ReservesPolicyData
} from '../../models/reserve.model';
import { Policy } from '../../models';
import rawPolicies from '../data/policies.json';
import policyDetails from '../data/policy-details.json';

interface CoinsuranceRow {
  participant: string;
  sharePercent: number;
}

/**
 * FNOL reserves, one record per claim. In FNOL every claim sits on its own
 * policy (BMPCC-22665: one claim per selected policy), so the policy number
 * is the key. A claim starts with no reserve lines: the handler adds them
 * through Add reserve (Section, Party, Damage, Reserve type), the same as
 * production's Reserves step (claims-management-main ReservesPage.ts). The
 * earlier version generated a zero line per party x damage type and kept a
 * made-up cross-policy seed for a "All policies" switch; both are gone.
 */
@Injectable({ providedIn: 'root' })
export class MockReservesService {
  private readonly policies = rawPolicies as unknown as Policy[];
  private readonly details = policyDetails as unknown as Record<
    string,
    { coinsurance?: CoinsuranceRow[] }
  >;
  private readonly cache = new Map<string, ReservesPolicyData>();

  getReservesForPolicy(policyNumber: string): Observable<ReservesPolicyData> {
    return of(this.getSync(policyNumber));
  }

  /** Same record as getReservesForPolicy, for callers that already run inside an async step. */
  getSync(policyNumber: string): ReservesPolicyData {
    const cached = this.cache.get(policyNumber);
    if (cached) return cached;
    const data: ReservesPolicyData = {
      policyNumber,
      allianzShare: this.allianzShare(policyNumber),
      currency: this.policies.find(p => p.policyNumber === policyNumber)?.currency ?? 'EUR',
      totalReserve: 0,
      reserves: []
    };
    this.cache.set(policyNumber, data);
    return data;
  }

  /** Adds the line, or replaces the one with the same reserveId. */
  upsertReserve(policyNumber: string, reserve: Reserve): Observable<boolean> {
    const data = this.getSync(policyNumber);
    const line = applyReserveTotals(structuredClone(reserve));
    const idx = data.reserves.findIndex(r => r.reserveId === line.reserveId);
    if (idx < 0) data.reserves.push(line);
    else data.reserves[idx] = line;
    this.recalculate(data);
    return of(true);
  }

  removeReserve(policyNumber: string, reserveId: string): Observable<boolean> {
    const data = this.getSync(policyNumber);
    const idx = data.reserves.findIndex(r => r.reserveId === reserveId);
    if (idx < 0) return of(false);
    data.reserves.splice(idx, 1);
    this.recalculate(data);
    return of(true);
  }

  setNarrative(policyNumber: string, narrative: ReserveNarrative): Observable<boolean> {
    const data = this.getSync(policyNumber);
    data.narrative = { ...narrative, savedAt: new Date().toISOString() };
    return of(true);
  }

  archiveNarrative(policyNumber: string): Observable<boolean> {
    const data = this.getSync(policyNumber);
    if (!data.narrative || data.narrative.archivedAt) return of(false);
    data.narrative = { ...data.narrative, archivedAt: new Date().toISOString() };
    return of(true);
  }

  /** DEV banner Apply starts every scenario from no reserves. */
  resetState(): void {
    this.cache.clear();
  }

  // ASSUMPTION [RES-D7]: Allianz share = the Allianz participant's share in
  // the policy's co-insurance (policy-details.json); 100% when the policy has
  // no co-insurance. Production shows "Allianz share" on each claim card but
  // its source is not in the local copy.
  private allianzShare(policyNumber: string): number {
    const rows = this.details[policyNumber]?.coinsurance ?? [];
    const allianz = rows.find(r => r.participant.startsWith('Allianz'));
    return allianz?.sharePercent ?? 100;
  }

  private recalculate(data: ReservesPolicyData): void {
    data.totalReserve = data.reserves.reduce((sum, r) => sum + (r.amount || 0), 0);
  }
}
