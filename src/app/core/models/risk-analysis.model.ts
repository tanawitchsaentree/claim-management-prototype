export type RiskScore            = 1 | 2 | 3 | 4 | 5;
export type InvestigationStatus  = 'Not started' | 'In progress' | 'Completed';
export type RiskStatusLabel      = 'Low risk' | 'Potential risk' | 'High risk';
export type InvestigationOutcome = 'N/A' | 'Fraud confirmed' | 'No fraud detected' | 'Inconclusive';

export interface RiskAnalysis {
  claimId:              string;
  riskScore:            RiskScore;
  riskStatus:           RiskStatusLabel;
  investigationStatus:  InvestigationStatus;
  investigationOutcome: InvestigationOutcome;
  lastScoreUpdated:     string;
  aiReasoning:          string;
  keyRiskFactors:       string[];
  assignee?:            string;
  deadline?:            string;
}
