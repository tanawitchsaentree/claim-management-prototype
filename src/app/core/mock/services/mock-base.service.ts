import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { MockStateService } from '../state/mock-state.service';

export abstract class MockBaseService {
  private readonly mockState = inject(MockStateService);

  protected get scenario() { return this.mockState.scenario(); }

  protected respond<T>(data: T): Observable<T> {
    if (this.shouldError()) {
      return throwError(() => this.buildError()).pipe(delay(this.scenario.delayMs));
    }
    return of(data).pipe(delay(this.scenario.delayMs));
  }

  protected list<T>(all: T[], forceEmpty = false): Observable<T[]> {
    if (this.scenario.forceEmpty || forceEmpty) {
      return this.respond([] as T[]);
    }
    if (this.scenario.forcePartial) {
      return this.respond(all.slice(0, Math.ceil(all.length / 2)));
    }
    return this.respond(all);
  }

  protected findById<T extends { [key: string]: unknown }>(
    all: T[],
    idField: string,
    id: string
  ): Observable<T> {
    const item = all.find(r => r[idField] === id);
    if (!item) {
      return throwError(() => this.buildError(404)).pipe(delay(this.scenario.delayMs));
    }
    return this.respond(item);
  }

  private shouldError(): boolean {
    return this.scenario.errorRate > 0 && Math.random() < this.scenario.errorRate;
  }

  private buildError(forceStatus?: number): HttpErrorResponse {
    const type = this.scenario.errorType;
    let status = forceStatus ?? 500;
    let statusText = 'Internal Server Error';

    if (!forceStatus) {
      if (type === '404') { status = 404; statusText = 'Not Found'; }
      else if (type === '403') { status = 403; statusText = 'Forbidden'; }
      else if (type === 'network') { status = 0; statusText = 'Network Error'; }
    } else if (forceStatus === 404) {
      statusText = 'Not Found';
    }

    const err = new HttpErrorResponse({ status, statusText, url: '/mock' });
    console.warn(`[MockService] Simulated ${status} (${statusText}) — scenario: ${this.scenario.name}`);
    return err;
  }
}
