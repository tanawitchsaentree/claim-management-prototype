import { Injectable, signal, computed } from '@angular/core';

export type ReferenceVariant = 'none' | 'panel' | 'tabs';

const DEMO_CLAIM_IDS = ['CLM-2024-011', 'CLM-2024-001', 'CL-2025-001'];

@Injectable({ providedIn: 'root' })
export class ReferenceViewService {
  readonly variant  = signal<ReferenceVariant>('none');
  readonly refClaimId = signal<string | null>(null);

  readonly isActive = computed(() => this.variant() !== 'none');
  readonly isPanelMode = computed(() => this.variant() === 'panel');
  readonly isTabsMode  = computed(() => this.variant() === 'tabs');

  setVariant(v: ReferenceVariant, primaryClaimId?: string | null): void {
    this.variant.set(v);
    if (v !== 'none' && !this.refClaimId()) {
      // Pick a different claim from the primary as default reference
      const fallback = DEMO_CLAIM_IDS.find(id => id !== primaryClaimId) ?? DEMO_CLAIM_IDS[0];
      this.refClaimId.set(fallback);
    }
    if (v === 'none') this.refClaimId.set(null);
  }

  setRefClaimId(id: string): void {
    this.refClaimId.set(id);
  }

  close(): void {
    this.variant.set('none');
    this.refClaimId.set(null);
  }
}
