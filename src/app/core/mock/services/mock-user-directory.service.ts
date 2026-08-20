import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import rawData from '../data/user-directory.json';

export interface UserDirectoryEntry {
  userId: string;
  name:   string;
  role:   string;
  email:  string;
}

const USERS = rawData as UserDirectoryEntry[];

@Injectable({ providedIn: 'root' })
export class MockUserDirectoryService {
  search(query: string): Observable<UserDirectoryEntry[]> {
    const q = query.trim().toLowerCase();
    if (!q) return of([]);
    const results = USERS.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    ).slice(0, 5);
    return of(results).pipe(delay(150));
  }

  getAll(): Observable<UserDirectoryEntry[]> {
    return of(USERS);
  }

  getClaimHandlers(): Observable<UserDirectoryEntry[]> {
    return of(USERS.filter(u => u.role === 'Claims Handler'));
  }
}
