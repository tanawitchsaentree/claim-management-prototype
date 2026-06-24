export type SectionStatus        = 'Open' | 'Closed';
export type InstructionStatus    = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';
export type SectionClosureReason = 'Section Finalised' | 'Section Not Pursued' | 'Section Rejected';

export interface SectionEntity {
  id:                string;
  name:              string;
  damage:            string;
  instructionStatus: InstructionStatus;
  expandable:        boolean;
  assignedProvider?: string | null;
}

export interface SectionBlockers {
  hasOpenDeductible:  boolean;
  hasActiveLitigation: boolean;
  hasSubrogation:     boolean;
  hasActiveSalvage:   boolean;
  hasOpenReserves:    boolean;
  hasOpenPayments:    boolean;
  hasActiveProvider:  boolean;
}

export interface ClaimSection extends SectionBlockers {
  id:             string;
  claimId:        string;
  name:           string;
  status:         SectionStatus;
  expanded:       boolean;
  entities:       SectionEntity[];
  closureDate?:   string;
  closedBy?:      { userId: string; name: string };
  closureReason?: SectionClosureReason;
}
