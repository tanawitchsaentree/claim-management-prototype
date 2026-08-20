export type LossAdjusterSurveyStatus = 'pending' | 'submitted' | 'declined';

export interface LossAdjusterSurvey {
  surveyId: string;
  assignmentId: string;
  claimId: string;
  rating: number | null;
  comments: string;
  status: LossAdjusterSurveyStatus;
  submittedBy?: string;
  submittedAt?: string;
}
