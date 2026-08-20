export interface ClaimDocument {
  documentId: string;
  claimId: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export interface ProviderCommunicationDraft {
  assignmentId: string;
  claimId: string;
  recipientType: 'internal' | 'external';
  subject: string;
  body: string;
  additionalInstructions: string;
  attachmentIds: string[];
  uploadedFileNames: string[];
}

export interface ProviderCommunicationResult {
  sentAt: string;
  subject: string;
  attachmentCount: number;
}
