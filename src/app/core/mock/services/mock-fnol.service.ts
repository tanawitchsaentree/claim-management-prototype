import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Fnol } from '../../models';
import { MockValidationError, validateFnol } from '../validation-rules';
import { MockBaseService } from './mock-base.service';
import fnolData from '../data/fnol.json';

export interface FnolSubmitResult {
  fnol: Fnol;
  validationErrors: MockValidationError[];
}

@Injectable({ providedIn: 'root' })
export class MockFnolService extends MockBaseService {
  private readonly fnols = fnolData as unknown as Fnol[];

  getAll(): Observable<Fnol[]> {
    return this.list(this.fnols);
  }

  getById(fnolId: string): Observable<Fnol> {
    return this.findById(this.fnols as unknown as Record<string, unknown>[], 'fnolId', fnolId) as unknown as Observable<Fnol>;
  }

  getByClaimId(claimId: string): Observable<Fnol | null> {
    const found = this.fnols.find(f => f.claimId === claimId) ?? null;
    return this.respond(found);
  }

  submit(payload: Omit<Fnol, 'fnolId' | 'submittedDate' | 'claimId' | 'status'>): Observable<FnolSubmitResult> {
    const errors = validateFnol(payload as Record<string, unknown>);

    if (errors.length > 0) {
      return throwError(() => ({ validationErrors: errors })).pipe(delay(this.scenario.delayMs));
    }

    const newFnol: Fnol = {
      ...payload,
      fnolId: `FNOL-${Date.now()}`,
      submittedDate: new Date().toISOString().split('T')[0],
      claimId: null,
      status: 'Submitted',
    } as unknown as Fnol;

    return this.respond({ fnol: newFnol, validationErrors: [] });
  }

  convertToClaim(fnolId: string, claimId: string): Observable<Fnol> {
    const existing = this.fnols.find(f => f.fnolId === fnolId);
    if (!existing) {
      return this.findById([], 'fnolId', fnolId) as unknown as Observable<Fnol>;
    }
    return this.respond({ ...existing, claimId, status: 'Converted' as Fnol['status'] });
  }
}
