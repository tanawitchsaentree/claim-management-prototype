export type RiskScore = 1 | 2 | 3 | 4 | 5;

export type InvestigationStatus = 'Not started' | 'In progress' | 'Completed';

export type RiskStatusLabel = 'Low risk' | 'Potential risk' | 'High risk';

export interface RiskAnalysis {
  claimId:             string;
  riskScore:           RiskScore;
  investigationStatus: InvestigationStatus;
  riskStatus:          RiskStatusLabel;
  aiReasoning:         string;
  keyRiskFactors:      string[];
  assignee?:           string;
  deadline?:           string;
}
