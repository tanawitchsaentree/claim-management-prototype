import { Injectable, signal, computed } from '@angular/core';

// 'claims-manager' (BMPCC-22395): sees own cases plus the direct team's.
export type DashboardRole = 'claims-handler' | 'kcm' | 'claims-manager';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'adjuster' | 'claimant';
  dashboardRole: DashboardRole;
  group: string;
}

export const PERSONAS: User[] = [
  {
    id: 'usr-mara',
    name: 'Mara Mustermann',
    email: 'mara.mustermann@claimsystem.com',
    role: 'adjuster',
    dashboardRole: 'claims-handler',
    group: 'GPG-001'
  },
  {
    id: 'usr-klaus',
    name: 'Klaus Schmidt',
    email: 'klaus.schmidt@claimsystem.com',
    role: 'admin',
    dashboardRole: 'kcm',
    group: 'GPG-001'
  },
  {
    id: 'usr-tobias',
    name: 'Tobias Grau',
    email: 'tobias.grau@allianz.com',
    role: 'adjuster',
    dashboardRole: 'claims-manager',
    group: 'GPG-001'
  }
];

const STORAGE_KEY = 'dashboard:persona';

function loadPersona(): User {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const found = PERSONAS.find(p => p.id === saved);
    if (found) return found;
  }
  return PERSONAS[0];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<User>(loadPersona());

  readonly user = this.currentUser.asReadonly();
  readonly isKcm = computed(() => this.currentUser().dashboardRole === 'kcm');
  readonly isClaimsManager = computed(
    () => this.currentUser().dashboardRole === 'claims-manager'
  );

  readonly personas = PERSONAS;

  setActivePersona(id: string): void {
    const p = PERSONAS.find(u => u.id === id);
    if (p) {
      localStorage.setItem(STORAGE_KEY, id);
      this.currentUser.set(p);
    }
  }

  isAuthenticated() {
    return true;
  }
}
