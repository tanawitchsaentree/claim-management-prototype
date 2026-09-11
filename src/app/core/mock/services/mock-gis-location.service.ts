import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { MockBaseService } from './mock-base.service';
import { GisAddressSuggestion } from '../../models';
import rawData from '../data/gis-addresses.json';

@Injectable({ providedIn: 'root' })
export class MockGisLocationService extends MockBaseService {
  private readonly addresses = rawData as GisAddressSuggestion[];

  // Plain substring match against the formatted address — GIS search is a
  // free-text address lookup, independent of any policy (unlike CWB).
  search(query: string): Observable<GisAddressSuggestion[]> {
    const q = query.trim().toLowerCase();
    if (!q) return this.respond([]);
    const results = this.addresses.filter(a => a.formattedAddress.toLowerCase().includes(q));
    return this.list(results);
  }
}
