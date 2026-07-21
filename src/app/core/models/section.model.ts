export type SectionStatus        = 'Open' | 'Closed';
export type InstructionStatus    = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';
export type SectionClosureReason = 'Section Finalised' | 'Section Not Pursued' | 'Section Rejected';
export type SectionReopenReason  = 'New information received' | 'Additional claim activity' | 'Reassessment required' | 'Error correction' | 'Other';
export type CoverageReview       = 'Standard Review' | 'Additional information required' | 'Enhanced review required';

export interface SectionEntity {
  id:                       string;
  name:                     string;
  damage:                   string;
  instructionStatus:        InstructionStatus;
  expandable:               boolean;
  assignedProvider?:        string | null;
  coverageReview?:          CoverageReview;
  coverageReviewNote?:      string;
  coverageReviewOverridden?: boolean;
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
  closureDate?:    string;
  closedBy?:       { userId: string; name: string };
  closureReason?:  SectionClosureReason;
  reopenedDate?:   string;
  reopenedBy?:     { userId: string; name: string };
  reopeningReason?: SectionReopenReason;
}
