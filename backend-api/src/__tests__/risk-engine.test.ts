import { calculateRisk, categorizeScore, RiskLevel } from '../services/risk/rule-engine';
import { makeHybridDecision, MlResult } from '../services/risk/hybrid-decision';
import { StudentFeatures, DataAvailability } from '../services/risk/feature-builder';

function makeFeatures(overrides: {
  attendancePercentage?: number | null;
  totalSessions?: number;
  sessionsAttended?: number;
  averageScorePercentage?: number | null;
  assessmentCount?: number;
  hasNegativeFeedback?: boolean;
  feedbackCount?: number;
  negativeFeedbackCount?: number;
} = {}): StudentFeatures {
  const hasAttendance = overrides.attendancePercentage !== undefined && overrides.attendancePercentage !== null;
  const hasAssessment = overrides.averageScorePercentage !== undefined && overrides.averageScorePercentage !== null;
  const hasFeedback = overrides.feedbackCount !== undefined && overrides.feedbackCount > 0;

  return {
    studentId: 'student-1',
    batchId: 'batch-1',
    attendance: hasAttendance
      ? {
          totalSessions: overrides.totalSessions ?? 10,
          sessionsAttended: overrides.sessionsAttended ?? 8,
          attendancePercentage: overrides.attendancePercentage!,
        }
      : null,
    assessment: hasAssessment
      ? {
          assessmentCount: overrides.assessmentCount ?? 4,
          averageScorePercentage: overrides.averageScorePercentage!,
        }
      : null,
    feedback: hasFeedback
      ? {
          feedbackCount: overrides.feedbackCount!,
          negativeFeedbackCount: overrides.negativeFeedbackCount ?? 0,
          hasNegativeFeedback: overrides.hasNegativeFeedback ?? false,
          averageEffortRating: 3,
          averageParticipationRating: 3,
        }
      : null,
    dataAvailability: {
      attendance: hasAttendance,
      assessment: hasAssessment,
      feedback: hasFeedback,
    },
  };
}

describe('Rule Engine — Basic rule cases', () => {
  // Test #1
  test('All metrics healthy → score 0, LOW', () => {
    const f = makeFeatures({
      attendancePercentage: 80, totalSessions: 10, sessionsAttended: 8,
      averageScorePercentage: 65, assessmentCount: 4,
      hasNegativeFeedback: false, feedbackCount: 5, negativeFeedbackCount: 0,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(0);
    expect(r.riskLevel).toBe('LOW');
  });

  // Test #2
  test('Low attendance only → score 20, LOW', () => {
    const f = makeFeatures({
      attendancePercentage: 70, totalSessions: 10, sessionsAttended: 7,
      averageScorePercentage: 65, assessmentCount: 4,
      hasNegativeFeedback: false, feedbackCount: 5, negativeFeedbackCount: 0,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(20);
    expect(r.riskLevel).toBe('LOW');
  });

  // Test #3
  test('Low assessment only → score 25, LOW', () => {
    const f = makeFeatures({
      attendancePercentage: 80, totalSessions: 10, sessionsAttended: 8,
      averageScorePercentage: 45, assessmentCount: 4,
      hasNegativeFeedback: false, feedbackCount: 5, negativeFeedbackCount: 0,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(25);
    expect(r.riskLevel).toBe('LOW');
  });

  // Test #4
  test('Negative feedback only → score 15, LOW', () => {
    const f = makeFeatures({
      attendancePercentage: 80, totalSessions: 10, sessionsAttended: 8,
      averageScorePercentage: 65, assessmentCount: 4,
      hasNegativeFeedback: true, feedbackCount: 5, negativeFeedbackCount: 1,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(15);
    expect(r.riskLevel).toBe('LOW');
  });

  // Test #5
  test('All rules triggered → score 60, MEDIUM', () => {
    const f = makeFeatures({
      attendancePercentage: 60, totalSessions: 10, sessionsAttended: 6,
      averageScorePercentage: 40, assessmentCount: 4,
      hasNegativeFeedback: true, feedbackCount: 5, negativeFeedbackCount: 2,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(60);
    expect(r.riskLevel).toBe('MEDIUM');
  });

  // Test #6
  test('Attendance + assessment → score 45, MEDIUM', () => {
    const f = makeFeatures({
      attendancePercentage: 50, totalSessions: 10, sessionsAttended: 5,
      averageScorePercentage: 30, assessmentCount: 4,
      hasNegativeFeedback: false, feedbackCount: 5, negativeFeedbackCount: 0,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(45);
    expect(r.riskLevel).toBe('MEDIUM');
  });

  // Test #7
  test('Attendance + feedback → score 35, MEDIUM', () => {
    const f = makeFeatures({
      attendancePercentage: 60, totalSessions: 10, sessionsAttended: 6,
      averageScorePercentage: 70, assessmentCount: 4,
      hasNegativeFeedback: true, feedbackCount: 5, negativeFeedbackCount: 1,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(35);
    expect(r.riskLevel).toBe('MEDIUM');
  });

  // Test #8
  test('Assessment + feedback → score 40, MEDIUM', () => {
    const f = makeFeatures({
      attendancePercentage: 90, totalSessions: 10, sessionsAttended: 9,
      averageScorePercentage: 40, assessmentCount: 4,
      hasNegativeFeedback: true, feedbackCount: 5, negativeFeedbackCount: 2,
    });
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(40);
    expect(r.riskLevel).toBe('MEDIUM');
  });
});

describe('Rule Engine — Boundary cases', () => {
  // Test #9
  test('Attendance exactly 75% → 0 risk', () => {
    const f = makeFeatures({ attendancePercentage: 75, totalSessions: 4, sessionsAttended: 3 });
    const r = calculateRisk(f);
    expect(r.attendanceRisk).toBe(0);
  });

  // Test #10
  test('Attendance just below 75% → 20 risk', () => {
    const f = makeFeatures({ attendancePercentage: 74.9, totalSessions: 10, sessionsAttended: 7 });
    const r = calculateRisk(f);
    expect(r.attendanceRisk).toBe(20);
  });

  // Test #11
  test('Assessment exactly 50% → 0 risk', () => {
    const f = makeFeatures({ averageScorePercentage: 50, assessmentCount: 4 });
    const r = calculateRisk(f);
    expect(r.assessmentRisk).toBe(0);
  });

  // Test #12
  test('Assessment just below 50% → 25 risk', () => {
    const f = makeFeatures({ averageScorePercentage: 49.9, assessmentCount: 4 });
    const r = calculateRisk(f);
    expect(r.assessmentRisk).toBe(25);
  });

  // Test #13
  test('Total score exactly 30 → LOW', () => {
    expect(categorizeScore(30)).toBe('LOW');
  });

  // Test #14
  test('Total score exactly 31 → MEDIUM', () => {
    expect(categorizeScore(31)).toBe('MEDIUM');
  });

  // Test #15
  test('Total score exactly 60 → MEDIUM', () => {
    expect(categorizeScore(60)).toBe('MEDIUM');
  });

  // Test #16
  test('Total score exactly 61 → HIGH', () => {
    expect(categorizeScore(61)).toBe('HIGH');
  });
});

describe('Rule Engine — Failure and edge cases', () => {
  // Test #18
  test('No attendance records → attendanceRisk = 0', () => {
    const f = makeFeatures({});
    const r = calculateRisk(f);
    expect(r.attendanceRisk).toBe(0);
  });

  // Test #19
  test('No assessment records → assessmentRisk = 0', () => {
    const f = makeFeatures({});
    const r = calculateRisk(f);
    expect(r.assessmentRisk).toBe(0);
  });

  // Test #20
  test('No feedback records → feedbackRisk = 0', () => {
    const f = makeFeatures({});
    const r = calculateRisk(f);
    expect(r.feedbackRisk).toBe(0);
  });

  // Test #21
  test('All data sources empty → score 0, LOW', () => {
    const f = makeFeatures({});
    const r = calculateRisk(f);
    expect(r.totalScore).toBe(0);
    expect(r.riskLevel).toBe('LOW');
  });
});

describe('Hybrid Decision Tests', () => {
  // Test #31
  test('Rule MEDIUM + ML HIGH → final HIGH (ML_ESCALATION)', () => {
    const ml: MlResult = {
      status: 'READY',
      modelVersion: 'v1',
      prediction: 'HIGH',
      confidence: 0.8,
      probabilities: { LOW: 0.05, MEDIUM: 0.15, HIGH: 0.8 },
    };
    const result = makeHybridDecision('MEDIUM', ml);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.decidedBy).toBe('ML_ESCALATION');
  });

  // Test #32
  test('Rule HIGH + ML MEDIUM → final HIGH (RULE_ENGINE, de-escalation blocked)', () => {
    const ml: MlResult = {
      status: 'READY',
      modelVersion: 'v1',
      prediction: 'MEDIUM',
      confidence: 0.7,
      probabilities: { LOW: 0.1, MEDIUM: 0.7, HIGH: 0.2 },
    };
    const result = makeHybridDecision('HIGH', ml);
    expect(result.riskLevel).toBe('HIGH');
    expect(result.decidedBy).toBe('RULE_ENGINE');
  });

  // Test #33
  test('Rule LOW + ML MEDIUM → final MEDIUM (ML_ESCALATION)', () => {
    const ml: MlResult = {
      status: 'READY',
      modelVersion: 'v1',
      prediction: 'MEDIUM',
      confidence: 0.6,
      probabilities: { LOW: 0.2, MEDIUM: 0.6, HIGH: 0.2 },
    };
    const result = makeHybridDecision('LOW', ml);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.decidedBy).toBe('ML_ESCALATION');
  });

  // Test #34
  test('Rule and ML agreement → agreed level (AGREEMENT)', () => {
    const ml: MlResult = {
      status: 'READY',
      modelVersion: 'v1',
      prediction: 'MEDIUM',
      confidence: 0.8,
      probabilities: { LOW: 0.1, MEDIUM: 0.8, HIGH: 0.1 },
    };
    const result = makeHybridDecision('MEDIUM', ml);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.decidedBy).toBe('AGREEMENT');
  });

  // Test #35
  test('ML not ready → rule-based result (RULE_ENGINE)', () => {
    const ml: MlResult = { status: 'NOT_READY' };
    const result = makeHybridDecision('MEDIUM', ml);
    expect(result.riskLevel).toBe('MEDIUM');
    expect(result.decidedBy).toBe('RULE_ENGINE');
    expect(result.ml.status).toBe('NOT_READY');
  });
});

describe('ML Failure Tests', () => {
  const failureModes: Array<{ status: MlResult['status']; testNum: number; label: string }> = [
    { status: 'UNAVAILABLE', testNum: 36, label: 'ML service connection refused' },
    { status: 'TIMEOUT', testNum: 37, label: 'ML request timeout' },
    { status: 'MALFORMED_RESPONSE', testNum: 38, label: 'ML returns malformed JSON' },
    { status: 'INVALID_PREDICTION', testNum: 39, label: 'ML returns invalid risk level' },
    { status: 'INVALID_PROBABILITIES', testNum: 40, label: 'ML returns invalid probabilities' },
  ];

  for (const { status, testNum, label } of failureModes) {
    test(`#${testNum}: ${label} → falls back to rule-based, ml.status = "${status}"`, () => {
      const ml: MlResult = { status };
      const result = makeHybridDecision('MEDIUM', ml);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.decidedBy).toBe('RULE_ENGINE');
      expect(result.ml.status).toBe(status);
    });
  }
});

describe('Model Metadata Tests', () => {
  // Test #62
  test('ML modelVersion is preserved in factors when ML is ready', () => {
    const ml: MlResult = {
      status: 'READY',
      modelVersion: 'risk-model-v1',
      prediction: 'HIGH',
      confidence: 0.68,
      probabilities: { LOW: 0.08, MEDIUM: 0.24, HIGH: 0.68 },
    };
    const result = makeHybridDecision('MEDIUM', ml);
    expect(result.ml.modelVersion).toBe('risk-model-v1');
  });

  // Test #63
  test('ML modelVersion is absent when ML is not ready', () => {
    const ml: MlResult = { status: 'NOT_READY' };
    const result = makeHybridDecision('LOW', ml);
    expect(result.ml).toEqual({ status: 'NOT_READY' });
    expect(result.ml.modelVersion).toBeUndefined();
  });
});
