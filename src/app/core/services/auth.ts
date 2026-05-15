import { Injectable, signal } from '@angular/core';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'adjuster' | 'claimant';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser = signal<User | null>({
    id: '1',
    name: 'Admin User',
    email: 'admin@claimsystem.com',
    role: 'admin',
  });

  user = this.currentUser.asReadonly();

  isAuthenticated() {
    return this.currentUser() !== null;
  }

  logout() {
    this.currentUser.set(null);
  }
}
