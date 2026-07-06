import { Injectable, signal, computed } from '@angular/core';

export type ReferenceVariant = 'none' | 'panel' | 'tabs';

export interface RefTab {
  id: string;
  claimId: string;
}

const MAX_REF_TABS = 5;
const DEMO_CLAIM_IDS = ['CLM-2024-011', 'CLM-2024-001', 'CL-2025-001'];

@Injectable({ providedIn: 'root' })
export class ReferenceViewService {
  readonly variant        = signal<ReferenceVariant>('none');
  readonly refTabs        = signal<RefTab[]>([]);
  readonly activeRefTabId = signal<string | null>(null);
  readonly primaryClaimId = signal<string | null>(null);

  readonly isActive    = computed(() => this.variant() !== 'none');
  readonly isPanelMode = computed(() => this.variant() === 'panel');
  readonly isTabsMode  = computed(() => this.variant() === 'tabs');
  readonly canAddRefTab = computed(() => this.refTabs().length < MAX_REF_TABS);

  // Backward-compat: panel mode still reads this; resolves to first ref tab
  readonly refClaimId = computed<string | null>(() =>
    this.refTabs()[0]?.claimId ?? null
  );

  readonly activeRefTab = computed<RefTab | null>(() => {
    const id = this.activeRefTabId();
    return this.refTabs().find(t => t.id === id) ?? null;
  });

  openRefTab(claimId: string): void {
    if (claimId === this.primaryClaimId()) return;
    const existing = this.refTabs().find(t => t.claimId === claimId);
    if (existing) {
      this.activeRefTabId.set(existing.id);
      return;
    }
    if (!this.canAddRefTab()) return;
    const tab: RefTab = { id: crypto.randomUUID(), claimId };
    this.refTabs.update(tabs => [...tabs, tab]);
    this.activeRefTabId.set(tab.id);
  }

  closeRefTab(tabId: string): void {
    const tabs = this.refTabs();
    const idx  = tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;
    const wasActive = this.activeRefTabId() === tabId;
    const next = tabs.filter(t => t.id !== tabId);
    this.refTabs.set(next);
    if (wasActive) {
      const newActive = next[idx - 1] ?? next[idx] ?? null;
      this.activeRefTabId.set(newActive?.id ?? null);
    }
  }

  setVariant(v: ReferenceVariant, primaryClaimId?: string | null): void {
    this.variant.set(v);
    if (v !== 'none') {
      if (primaryClaimId) this.primaryClaimId.set(primaryClaimId);
      if (this.refTabs().length === 0) {
        const pid = primaryClaimId ?? this.primaryClaimId();
        const fallbackId = DEMO_CLAIM_IDS.find(id => id !== pid) ?? DEMO_CLAIM_IDS[0];
        this.openRefTab(fallbackId);
      }
    }
    if (v === 'none') {
      this.refTabs.set([]);
      this.activeRefTabId.set(null);
      this.primaryClaimId.set(null);
    }
  }

  setRefClaimId(id: string): void {
    this.openRefTab(id);
  }

  close(): void {
    this.variant.set('none');
    this.refTabs.set([]);
    this.activeRefTabId.set(null);
    this.primaryClaimId.set(null);
  }
}
