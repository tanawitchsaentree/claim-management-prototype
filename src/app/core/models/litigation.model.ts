export type LitigationStatus = 'Draft' | 'In progress' | 'Closed';

export type LitigationType =
  | 'Coverage'
  | 'Defense'
  | 'Recovery'
  | 'Pursuit';

export interface LitigationParty {
  partyId: string;
  name: string;
  role?: string;
}

export interface LitigationAttorney {
  attorneyId: string;
  name: string;
  firm?: string;
}

export interface LitigationExpense {
  rowId:    string;
  subType:  'Litigation' | 'Legal fees' | 'Other';
  currency: 'EUR' | 'USD' | 'GBP';
  amount:   number;
  section:  'BI' | 'PD' | 'PI';
}

export interface LitigationCase {
  caseId:    string;
  caseTitle: string;
  hearingDate?: string;
}

export interface Litigation {
  id:          string;            // 123456.1-LIT-1
  claimId:     string;
  clientName:  string;
  type:        LitigationType | '';
  startDate:   string;             // ISO yyyy-mm-dd
  status:      LitigationStatus;
  title?:      string;
  description?:string;
  jurisdiction?:string;
  plaintiff?:   LitigationParty;
  defendant?:   LitigationParty;
  attorney?:    LitigationAttorney;
  opposingLawyer?: LitigationAttorney;
  expenses:    LitigationExpense[];
  cases:       LitigationCase[];
}

export interface LitigationFilters {
  claimId?: string;
  status?:  LitigationStatus;
}
