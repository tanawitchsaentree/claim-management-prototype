export type ReserveType = 'indemnity' | 'expenses' | 'recoveries';

export type CoInsuranceFlag = 'RI' | 'CO' | 'NONE';

export interface SubReserve {
  subReserveId: string;
  subType: string; // e.g. "Lorem ipsum" — placeholder for sub-type lookup
  currency: string;
  amount: number;
  coInsurance: CoInsuranceFlag;
}

export interface DamagedItem {
  damagedItemId: string;
  itemName: string; // e.g. "Kaufmann's Warehouse: Gate"
  expanded?: boolean;
  // Per-tab sub-reserves
  subReserves: Partial<Record<ReserveType, SubReserve[]>>;
}

export interface Reserve {
  reserveId: string;

  // Identity — auto-populated from upstream steps
  sectionNo: number;
  partyId: string;
  partyName: string;
  damageType: string; // display label: "Material damage"
  damageTypeKey: string; // lookup key: "material-damage"

  // User-fillable via Add reserve modal
  reserveType?: ReserveType;
  currency: string;
  amount: number;

  // Section limits (mock — for summary panel)
  limit?: number;

  // Per-reserve-type amounts (master/detail breakdown)
  subAmounts?: Partial<Record<ReserveType, number>>;

  // Damaged items under this section — drives the right-panel breakdown UI.
  damagedItems?: DamagedItem[];

  // Toggle "Reserves on damaged item level" (right panel)
  damagedItemLevel?: boolean;

  // Optional item-level drill-down (legacy — kept for back-compat)
  damagedItemId?: string;

  recentlyAdded?: boolean;
}

export interface ReserveNarrative {
  reasonKey: string;
  notes?: string;
  savedAt: string;
  archivedAt?: string;
}

export interface ReservesPolicyData {
  policyNumber: string;
  allianzShare: number;
  currency: string;
  totalReserve: number;
  reserves: Reserve[];
  narrative?: ReserveNarrative;
}

export const RESERVE_TYPE_LABELS: Record<ReserveType, string> = {
  'indemnity': 'Indemnity',
  'expenses': 'Expenses',
  'recoveries': 'Recoveries'
};

export const RESERVE_TYPES: ReserveType[] = ['indemnity', 'expenses', 'recoveries'];

/** Sum of every sub-reserve of one type across a line's damaged items. */
export function reserveTypeTotal(reserve: Reserve, type: ReserveType): number {
  return (reserve.damagedItems ?? []).reduce(
    (sum, it) => sum + (it.subReserves[type] ?? []).reduce((s, r) => s + (r.amount || 0), 0),
    0
  );
}

/**
 * Recomputes subAmounts and amount in place. Recoveries net OFF the reserve,
 * they never add to it: money coming back reduces exposure. Verified against
 * production's Reserves e2e (ReservesPage.ts verifyReserveValuesInTable:
 * indemnity 5,000 + expense 3,000 - recovery 250 = total 7,750). The one place
 * this sum lives, so the editor, the list and the service can't drift apart.
 */
export function applyReserveTotals(reserve: Reserve): Reserve {
  const [indemnity, expenses, recoveries] = RESERVE_TYPES.map(t => reserveTypeTotal(reserve, t));
  reserve.subAmounts = { indemnity, expenses, recoveries };
  reserve.amount = indemnity + expenses - recoveries;
  return reserve;
}

/** Production gate wording: "Please add a indemnity reserve or a narrative before proceeding." */
export function hasIndemnityReserve(data: ReservesPolicyData | null | undefined): boolean {
  return !!data?.reserves.some(r => (r.subAmounts?.indemnity ?? 0) > 0);
}

/**
 * v2.6 DEV-banner setup for the FNOL Reserves step (FNOL-RESERVES-MULTI):
 * ticks every entity of the policies the FNOL runs on (so each claim has
 * sections) and adds these parties from parties.json. `seed` enters a reserve
 * on a claim first (its first section, party and damaged entity).
 */
export interface ReservesStepOverride {
  partyIds: string[];
  seed?: { policyNumber: string; indemnity?: number; expenses?: number; recoveries?: number }[];
}
