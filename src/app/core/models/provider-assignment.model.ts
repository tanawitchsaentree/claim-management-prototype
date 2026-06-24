export type ProviderType = 'adjuster' | 'legal' | 'expert' | 'other';
export type ProviderAssignmentStatus = 'Active' | 'Completed' | 'Cancelled';

export interface ProviderAssignment {
  assignmentId: string;
  claimId: string;
  sectionId: string;
  providerName: string;
  providerType: ProviderType;
  status: ProviderAssignmentStatus;
  assignedDate: string;
}

export interface ProviderAssignmentFilters {
  claimId?: string;
  sectionId?: string;
  providerType?: ProviderType;
  status?: ProviderAssignmentStatus;
}
