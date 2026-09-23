import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ClientSearchResult } from '../../../features/fnol/models/fnol-form.model';
import clientsData from '../data/clients.json';

@Injectable({ providedIn: 'root' })
export class MockClientSearchService extends MockBaseService {
  private readonly clients = clientsData as ClientSearchResult[];

  searchClients(criteria: { clientName?: string }): Observable<ClientSearchResult[]> {
    const q = criteria.clientName?.trim().toLowerCase();
    if (!q) {
      return this.respond([]);
    }

    const results = this.clients.filter(c => c.legalName.toLowerCase().includes(q));
    return this.list(results);
  }
}
