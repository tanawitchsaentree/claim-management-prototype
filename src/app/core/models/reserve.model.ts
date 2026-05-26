export type ReserveType = 'indemnity' | 'expenses' | 'recoveries';

export type CoInsuranceFlag = 'RI' | 'CO' | 'NONE';

export interface SubReserve {
  subReserveId: string;
  subType: string;          // e.g. "Lorem ipsum" — placeholder for sub-type lookup
  currency: string;
  amount: number;
  coInsurance: CoInsuranceFlag;
}

export interface DamagedItem {
  damagedItemId: string;
  itemName: string;          // e.g. "Kaufmann's Warehouse: Gate"
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
  damageType: string;     // display label: "Material damage"
  damageTypeKey: string;  // lookup key: "material-damage"

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
  'indemnity':  'Indemnity',
  'expenses':   'Expenses',
  'recoveries': 'Recoveries',
};
