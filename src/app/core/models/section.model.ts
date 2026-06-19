export type SectionStatus      = 'Open' | 'Closed';
export type InstructionStatus  = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';

export interface SectionEntity {
  id:                string;
  name:              string;
  damage:            string;
  instructionStatus: InstructionStatus;
  expandable:        boolean;
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
  id:          string;
  claimId:     string;
  name:        string;
  status:      SectionStatus;
  expanded:    boolean;
  entities:    SectionEntity[];
  closureDate?: string;
  closedBy?:   { userId: string; name: string };
}
