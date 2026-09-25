import { StudentFeatures } from './feature-builder';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RuleEngineResult {
  attendanceRisk: number;
  assessmentRisk: number;
  feedbackRisk: number;
  totalScore: number;
  riskLevel: RiskLevel;
  details: {
    attendancePercentage: number | null;
    averageAssessmentScore: number | null;
    negativeFeedbackPresent: boolean;
    totalSessions: number;
    sessionsAttended: number;
    assessmentCount: number;
    feedbackCount: number;
    negativeFeedbackCount: number;
  };
}

export function categorizeScore(score: number): RiskLevel {
  if (score <= 30) return 'LOW';
  if (score <= 60) return 'MEDIUM';
  return 'HIGH';
}

export function calculateRisk(features: StudentFeatures): RuleEngineResult {
  const attendanceRisk =
    features.attendance && features.attendance.attendancePercentage < 75 ? 20 : 0;

  const assessmentRisk =
    features.assessment && features.assessment.averageScorePercentage < 50 ? 25 : 0;

  const feedbackRisk =
    features.feedback && features.feedback.hasNegativeFeedback ? 15 : 0;

  const totalScore = attendanceRisk + assessmentRisk + feedbackRisk;
  const riskLevel = categorizeScore(totalScore);

  return {
    attendanceRisk,
    assessmentRisk,
    feedbackRisk,
    totalScore,
    riskLevel,
    details: {
      attendancePercentage: features.attendance?.attendancePercentage ?? null,
      averageAssessmentScore: features.assessment?.averageScorePercentage ?? null,
      negativeFeedbackPresent: features.feedback?.hasNegativeFeedback ?? false,
      totalSessions: features.attendance?.totalSessions ?? 0,
      sessionsAttended: features.attendance?.sessionsAttended ?? 0,
      assessmentCount: features.assessment?.assessmentCount ?? 0,
      feedbackCount: features.feedback?.feedbackCount ?? 0,
      negativeFeedbackCount: features.feedback?.negativeFeedbackCount ?? 0,
    },
  };
}
