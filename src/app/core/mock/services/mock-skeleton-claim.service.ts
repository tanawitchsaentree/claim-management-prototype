import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockBaseService } from './mock-base.service';
import { SkeletonClaim, CreateSkeletonData } from '../../../core/models/skeleton-claim.model';
import skeletonData from '../data/skeleton-claims.json';

@Injectable({ providedIn: 'root' })
export class MockSkeletonClaimService extends MockBaseService {
  private skeletons: SkeletonClaim[] = (skeletonData as SkeletonClaim[]).map(s => this.withComputed(s));

  getById(claimId: string): Observable<SkeletonClaim> {
    const item = this.skeletons.find(s => s.claimId === claimId);
    if (!item) {
      return throwError(() => new Error(`Skeleton claim ${claimId} not found`)).pipe(
        delay(this.scenario.delayMs)
      );
    }
    return this.respond(this.withComputed(item));
  }

  create(data: CreateSkeletonData): Observable<SkeletonClaim> {
    const claimId = `CLM-SKEL-${Date.now()}`;
    const now = new Date().toISOString();
    const skeleton: SkeletonClaim = {
      claimId,
      claimType: 'skeleton',
      clientName: data.clientName,
      lossDescription: data.notes ?? '',
      lossDate: data.lossDate ?? null,
      createdBy: data.createdBy,
      createdDate: now,
      assignee: null,
      status: 'awaiting-policy',
      skeletonReason: data.reason,
      policyId: null,
      linkedBy: null,
      linkedDate: null,
      daysSinceCreation: 0,
      slaDeadlineDays: 3,
    };
    this.skeletons.push(skeleton);
    return this.respond(skeleton);
  }

  matchToPolicy(
    skeletonId: string,
    policyId: string,
    userId: string,
    linkedClaimId?: string,
  ): Observable<SkeletonClaim> {
    const idx = this.skeletons.findIndex(s => s.claimId === skeletonId);
    if (idx === -1) {
      return throwError(() => new Error(`Skeleton claim ${skeletonId} not found`)).pipe(
        delay(this.scenario.delayMs)
      );
    }
    this.skeletons[idx] = {
      ...this.skeletons[idx],
      status: 'matched',
      policyId,
      linkedBy: userId,
      linkedDate: new Date().toISOString(),
      ...(linkedClaimId ? { linkedClaimId } : {}),
    };
    return this.respond(this.withComputed(this.skeletons[idx]));
  }

  abandon(skeletonId: string, reason: string): Observable<SkeletonClaim> {
    const idx = this.skeletons.findIndex(s => s.claimId === skeletonId);
    if (idx === -1) {
      return throwError(() => new Error(`Skeleton claim ${skeletonId} not found`)).pipe(
        delay(this.scenario.delayMs)
      );
    }
    this.skeletons[idx] = {
      ...this.skeletons[idx],
      status: 'abandoned',
      abandonReason: reason,
    };
    return this.respond(this.withComputed(this.skeletons[idx]));
  }

  private withComputed(s: SkeletonClaim): SkeletonClaim {
    return { ...s, daysSinceCreation: this.computeDaysSince(s.createdDate) };
  }

  private computeDaysSince(createdDate: string): number {
    const created = new Date(createdDate);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }
}
