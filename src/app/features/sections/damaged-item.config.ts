/**
 * Vocabulary shared by add-damaged-item-modal and edit-damaged-item-modal.
 *
 * Both modals had their own copy of DAMAGE_OPTIONS. That was harmless while the
 * list was the only thing they shared, but the Financial loss fields key off one
 * exact string in it — two copies of that string is two places for it to drift,
 * and drift here silently stops the conditional fields from ever rendering.
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
 * The damage type that unlocks the "Financial loss caused by" / "Financial loss
 * details" pair. A financial loss has no physical damage to describe, so the
 * generic Description field alone leaves the file with no record of which peril
 * produced the loss — which is the one thing coverage turns on.
 */
export const FINANCIAL_LOSS_DAMAGE = 'Financial loss';
