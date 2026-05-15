import { Injectable } from '@angular/core';
import { ACVerification } from '../../features/claims/dev-banner/claim-dev-helper.service';

@Injectable({ providedIn: 'root' })
export class DevToolStorageService {
  private readonly VERIFICATIONS_KEY = 'dev-tool:verifications';
  private readonly VERIFIER_KEY      = 'dev-tool:verifier-name';

  loadVerifications(): Map<string, ACVerification> {
    try {
      const raw = localStorage.getItem(this.VERIFICATIONS_KEY);
      if (!raw) return new Map();
      const obj = JSON.parse(raw) as Record<string, ACVerification>;
      return new Map(Object.entries(obj));
    } catch {
      return new Map();
    }
  }

  saveVerifications(map: Map<string, ACVerification>): void {
    try {
      localStorage.setItem(this.VERIFICATIONS_KEY, JSON.stringify(Object.fromEntries(map)));
    } catch (e) {
      console.warn('Failed to persist verifications', e);
    }
  }

  loadVerifierName(): string | null {
    return localStorage.getItem(this.VERIFIER_KEY);
  }

  saveVerifierName(name: string): void {
    localStorage.setItem(this.VERIFIER_KEY, name);
  }

  clearVerifierName(): void {
    localStorage.removeItem(this.VERIFIER_KEY);
  }

  clearAll(): void {
    localStorage.removeItem(this.VERIFICATIONS_KEY);
    localStorage.removeItem(this.VERIFIER_KEY);
  }
}
