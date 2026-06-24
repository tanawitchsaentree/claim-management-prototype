import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ClaimPayment, ClaimPaymentFilters } from '../../models/payment.model';
import { MockBaseService } from './mock-base.service';
import rawData from '../data/payments.json';

@Injectable({ providedIn: 'root' })
export class MockPaymentsService extends MockBaseService {
  private cache = new Map<string, ClaimPayment[]>();

  constructor() {
    super();
    this.seedCache();
  }

  private seedCache(): void {
    const all = rawData as unknown as ClaimPayment[];
    for (const payment of all) {
      const bucket = this.cache.get(payment.claimId) ?? [];
      bucket.push({ ...payment });
      this.cache.set(payment.claimId, bucket);
    }
  }

  resetCache(): void {
    this.cache.clear();
    this.seedCache();
  }

  search(filters?: ClaimPaymentFilters): Observable<ClaimPayment[]> {
    let results: ClaimPayment[] = [];
    for (const bucket of this.cache.values()) {
      results = results.concat(bucket);
    }
    if (filters?.claimId)   results = results.filter(p => p.claimId   === filters.claimId);
    if (filters?.sectionId) results = results.filter(p => p.sectionId === filters.sectionId);
    if (filters?.status)    results = results.filter(p => p.status    === filters.status);
    return this.respond(results.map(p => ({ ...p })));
  }

  getOpenPaymentsForClaim(claimId: string): Observable<ClaimPayment[]> {
    const bucket = this.cache.get(claimId) ?? [];
    const pending = bucket.filter(p => p.status === 'Pending').map(p => ({ ...p }));
    return this.respond(pending);
  }

  patchStatus(paymentStatuses: Record<string, 'Pending' | 'Processed' | 'Final'>): void {
    for (const bucket of this.cache.values()) {
      for (const payment of bucket) {
        if (paymentStatuses[payment.paymentId] !== undefined) {
          payment.status = paymentStatuses[payment.paymentId];
        }
      }
    }
  }

  triggerFinalPayment(claimId: string, sectionId: string): Observable<ClaimPayment> {
    const bucket = this.cache.get(claimId);
    if (!bucket) {
      return throwError(() => new Error(`No payments found for claim ${claimId}`));
    }
    const target = bucket.find(p => p.sectionId === sectionId && p.status === 'Pending');
    if (!target) {
      return throwError(() => new Error(`No pending payment for section ${sectionId}`));
    }
    target.isFinalPayment = true;
    target.status         = 'Final';
    return this.respond({ ...target });
  }
}
