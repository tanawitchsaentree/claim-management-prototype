import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { ClientSearchResult } from '../../../core/models';
import clientsData from '../data/clients.json';

@Injectable({ providedIn: 'root' })
export class MockClientSearchService extends MockBaseService {
  private readonly clients = clientsData as ClientSearchResult[];

  searchClients(query: string): Observable<ClientSearchResult[]> {
    if (!query?.trim()) return this.respond([]);
    const q = query.toLowerCase();
    return this.list(this.clients.filter(c =>
      c.legalName.toLowerCase().includes(q) ||
      c.partyId.toLowerCase().includes(q)
    ));
  }
}
