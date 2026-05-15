export type SectionStatus      = 'Open' | 'Closed';
export type InstructionStatus  = 'Pending' | 'Not assigned' | 'In progress' | 'Completed';

export interface SectionEntity {
  id:                string;
  name:              string;
  damage:            string;
  instructionStatus: InstructionStatus;
  expandable:        boolean;
}

export interface ClaimSection {
  id:          string;
  claimId:     string;
  name:        string;
  status:      SectionStatus;
  expanded:    boolean;
  entities:    SectionEntity[];
  closureDate?: string;
  closedBy?:   { userId: string; name: string };
}
