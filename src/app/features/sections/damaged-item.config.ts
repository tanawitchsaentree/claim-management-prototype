/**
 * Vocabulary and shape shared by add-damaged-item-modal and
 * edit-damaged-item-modal.
 *
 * Both modals had their own copy of DAMAGE_OPTIONS. That was harmless while the
 * list was the only thing they shared, but the conditional fields key off exact
 * strings in it — two copies of those strings is two places for them to drift,
 * and drift here silently stops the conditional fields from ever rendering.
 *
 * NOT exported through core/models: `reserve.model.ts` already exports an
 * unrelated `DamagedItem` (a reserve line, keyed by damagedItemId). Keeping this
 * one feature-local is what stops the two from being imported by mistake.
 */
export const DAMAGE_OPTIONS: string[] = [
  'Material damage',
  'Business interruption',
  'Machinery breakdown',
  'Financial loss',
  'Bodily injury',
  'Liability',
];

/**
 * The damage type that unlocks the "Financial loss details" field, and relabels
 * "Caused by" to "Financial loss caused by". A financial loss has no physical
 * damage to describe, so the working of how the figure was reached is the one
 * thing the generic Description field cannot carry.
 */
export const FINANCIAL_LOSS_DAMAGE = 'Financial loss';

/**
 * The damage type that unlocks the injured-person block (name, country, role).
 * A bodily injury is recorded against a person, not a thing — without those
 * fields the item names an injury with nobody attached to it. Mirrors the
 * production `bodily-injury-new-employee` sub-form in the entities-damages MFE.
 */
export const BODILY_INJURY_DAMAGE = 'Bodily injury';

export interface DamagedItem {
  name: string;
  description: string;
  damage: string;
  /**
   * The peril behind the item. Applies to EVERY damage type, not just Financial
   * loss (2026-09-03) — the production material-damage table has a per-row
   * "Caused by" dropdown, and a burst pipe versus a fire on the same warehouse
   * wall is the distinction coverage turns on. Was `financialLossCausedBy` and
   * rendered only for Financial loss, which meant a material-damage item could
   * not record its cause at all.
   */
  causedBy?: string;
  /** Only meaningful when damage === FINANCIAL_LOSS_DAMAGE. */
  financialLossDetails?: string;
  /** Only meaningful when damage === BODILY_INJURY_DAMAGE. */
  injuredPartyName?: string;
  injuredPartyCountry?: string;
  injuredPartyRole?: string;
}

/** The raw form value both modals hold. Nullable because dropdowns start unset. */
export interface DamagedItemFormValue {
  name?: string | null;
  description?: string | null;
  damage?: string | null;
  causedBy?: string | null;
  financialLossDetails?: string | null;
  injuredPartyName?: string | null;
  injuredPartyCountry?: string | null;
  injuredPartyRole?: string | null;
}

/**
 * True when a control the current damage type makes mandatory is still empty.
 * Lives here rather than in each modal because the two forms are otherwise
 * identical and a rule added to one and not the other is invisible until a
 * handler saves a half-filled item.
 *
 * `causedBy` is required for every type now — the point of generalising it is
 * that an item without a cause is incomplete regardless of what was damaged.
 */
export function damagedItemMissingConditional(v: DamagedItemFormValue): boolean {
  if (!v.causedBy) return true;
  if (v.damage === BODILY_INJURY_DAMAGE && !v.injuredPartyName?.trim()) return true;
  return false;
}

/**
 * Form value → record. Fields belonging to a branch the current damage type is
 * not on are dropped, not merely hidden: leaving a stale injured person on an
 * item switched to Material damage would show a party on the row that nothing
 * on screen let the handler change.
 */
export function buildDamagedItem(v: DamagedItemFormValue): DamagedItem {
  const damage = v.damage ?? '';
  return {
    name:        v.name ?? '',
    description: v.description ?? '',
    damage,
    causedBy:    v.causedBy ?? undefined,
    ...(damage === FINANCIAL_LOSS_DAMAGE
      ? { financialLossDetails: v.financialLossDetails || undefined }
      : {}),
    ...(damage === BODILY_INJURY_DAMAGE
      ? {
          injuredPartyName:    v.injuredPartyName?.trim() || undefined,
          injuredPartyCountry: v.injuredPartyCountry || undefined,
          injuredPartyRole:    v.injuredPartyRole || undefined,
        }
      : {}),
  };
}
