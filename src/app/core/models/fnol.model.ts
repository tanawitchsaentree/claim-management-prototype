export type FnolStatus = 'Submitted' | 'Under review' | 'Converted' | 'Rejected';

export interface FnolAttachment {
  filename: string;
  size: number;
  mimeType: string;
}

export interface Fnol {
  fnolId: string;
  claimId: string | null;
  submittedDate: string;
  submitter: string;
  policyNumber: string;
  lossDate: string;
  lossDescription: string;
  lossAmount: number;
  currency: string;
  attachments: FnolAttachment[];
  status: FnolStatus;
}
