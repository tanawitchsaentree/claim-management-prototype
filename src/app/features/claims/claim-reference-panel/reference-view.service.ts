import { Injectable, signal, computed } from '@angular/core';

export type ReferenceVariant = 'none' | 'panel' | 'tabs' | 'popover';

export interface RefTab {
  id: string;
  claimId: string;
}

export const MAX_REF_TABS = 3;
const DEMO_CLAIM_IDS = ['CLM-2024-011', 'CLM-2024-001', 'CL-2025-001'];

@Injectable({ providedIn: 'root' })
export class ReferenceViewService {
  readonly variant        = signal<ReferenceVariant>('none');
  readonly refTabs        = signal<RefTab[]>([]);
  readonly activeRefTabId = signal<string | null>(null);
  readonly primaryClaimId = signal<string | null>(null);

  readonly isActive      = computed(() => this.variant() !== 'none');
  readonly isPanelMode   = computed(() => this.variant() === 'panel');
  readonly isTabsMode    = computed(() => this.variant() === 'tabs');
  readonly isPopoverMode = computed(() => this.variant() === 'popover');
  readonly canAddRefTab = computed(() => this.refTabs().length < MAX_REF_TABS);
  readonly refTabCount  = computed(() => this.refTabs().length);

  // Active tab object (used by panel to load claim data)
  readonly activeRefTab = computed<RefTab | null>(() => {
    const id = this.activeRefTabId();
    return this.refTabs().find(t => t.id === id) ?? this.refTabs()[0] ?? null;
  });

  // Backward-compat: first ref tab claimId (panel mode single-tab legacy)
  readonly refClaimId = computed<string | null>(() =>
    this.activeRefTab()?.claimId ?? null
  );

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
    // If no tabs left, close panel mode too
    if (next.length === 0 && this.variant() === 'panel') {
      this.variant.set('none');
    }
  }

  setVariant(v: ReferenceVariant, primaryClaimId?: string | null): void {
    this.variant.set(v);
    if (v === 'none' || v === 'popover') {
      this.refTabs.set([]);
      this.activeRefTabId.set(null);
      if (v === 'none') this.primaryClaimId.set(null);
      return;
    }
    if (primaryClaimId) this.primaryClaimId.set(primaryClaimId);
    if (this.refTabs().length === 0) {
      const pid = primaryClaimId ?? this.primaryClaimId();
      const fallbackId = DEMO_CLAIM_IDS.find(id => id !== pid) ?? DEMO_CLAIM_IDS[0];
      this.openRefTab(fallbackId);
    }
  }

  // Called by strip icon toggle — opens panel mode with primaryClaimId
  togglePanelMode(primaryClaimId: string): void {
    if (this.variant() === 'panel') {
      this.close();
    } else {
      this.setVariant('panel', primaryClaimId);
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
