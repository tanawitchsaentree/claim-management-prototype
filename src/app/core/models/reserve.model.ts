export type ReserveType = 'indemnity' | 'expenses' | 'recoveries';

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

  // Optional item-level drill-down (Phase 4)
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
