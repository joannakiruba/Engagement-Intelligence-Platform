import { getMlPrediction, buildPayload, validatePrediction, validateProbabilities } from '../services/ml.service';
import { StudentFeatures } from '../services/risk/feature-builder';

function makeFeatures(overrides: Partial<{
  attendancePercentage: number;
  averageScorePercentage: number;
  averageEffortRating: number;
  averageParticipationRating: number;
  negativeFeedbackCount: number;
}> = {}): StudentFeatures {
  return {
    studentId: 'student-1',
    batchId: 'batch-1',
    attendance: overrides.attendancePercentage !== undefined
      ? { totalSessions: 10, sessionsAttended: 8, attendancePercentage: overrides.attendancePercentage }
      : null,
    assessment: overrides.averageScorePercentage !== undefined
      ? { assessmentCount: 4, averageScorePercentage: overrides.averageScorePercentage }
      : null,
    feedback: overrides.averageEffortRating !== undefined
      ? {
          feedbackCount: 5,
          negativeFeedbackCount: overrides.negativeFeedbackCount ?? 0,
          hasNegativeFeedback: (overrides.negativeFeedbackCount ?? 0) > 0,
          averageEffortRating: overrides.averageEffortRating,
          averageParticipationRating: overrides.averageParticipationRating ?? 3,
        }
      : null,
    dataAvailability: {
      attendance: overrides.attendancePercentage !== undefined,
      assessment: overrides.averageScorePercentage !== undefined,
      feedback: overrides.averageEffortRating !== undefined,
    },
  };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(body: any, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as any;
}

function mockFetchError(error: Error) {
  global.fetch = jest.fn().mockRejectedValue(error) as any;
}

function mockFetchAbort() {
  const err = new Error('The operation was aborted');
  err.name = 'AbortError';
  global.fetch = jest.fn().mockRejectedValue(err) as any;
}

// =========================================================================
// buildPayload
// =========================================================================
describe('buildPayload', () => {
  test('maps StudentFeatures to ML payload with defaults for missing data', () => {
    const features = makeFeatures({});
    const payload = buildPayload(features);
    expect(payload.studentId).toBe('student-1');
    expect(payload.batchId).toBe('batch-1');
    expect(payload.attendancePercentage).toBe(0);
    expect(payload.assessmentPercentage).toBe(0);
    expect(payload.averageEffortRating).toBe(0);
    expect(payload.averageParticipationRating).toBe(0);
    expect(payload.negativeFeedbackCount).toBe(0);
  });

  test('maps available features correctly', () => {
    const features = makeFeatures({
      attendancePercentage: 80,
      averageScorePercentage: 70,
      averageEffortRating: 3.5,
      averageParticipationRating: 4.0,
      negativeFeedbackCount: 2,
    });
    const payload = buildPayload(features);
    expect(payload.attendancePercentage).toBe(80);
    expect(payload.assessmentPercentage).toBe(70);
    expect(payload.averageEffortRating).toBe(3.5);
    expect(payload.averageParticipationRating).toBe(4.0);
    expect(payload.negativeFeedbackCount).toBe(2);
  });
});

// =========================================================================
// validatePrediction
// =========================================================================
describe('validatePrediction', () => {
  test('accepts LOW', () => expect(validatePrediction('LOW')).toBe(true));
  test('accepts MEDIUM', () => expect(validatePrediction('MEDIUM')).toBe(true));
  test('accepts HIGH', () => expect(validatePrediction('HIGH')).toBe(true));
  test('rejects invalid class', () => expect(validatePrediction('CRITICAL')).toBe(false));
  test('rejects missing prediction', () => expect(validatePrediction(undefined)).toBe(false));
  test('rejects numeric', () => expect(validatePrediction(42)).toBe(false));
});

// =========================================================================
// validateProbabilities
// =========================================================================
describe('validateProbabilities', () => {
  test('accepts valid probabilities', () => {
    expect(validateProbabilities({ LOW: 0.3, MEDIUM: 0.5, HIGH: 0.2 })).toBe(true);
  });

  test('rejects missing probabilities', () => {
    expect(validateProbabilities(null)).toBe(false);
    expect(validateProbabilities(undefined)).toBe(false);
  });

  test('rejects probability < 0', () => {
    expect(validateProbabilities({ LOW: -0.1, MEDIUM: 0.6, HIGH: 0.5 })).toBe(false);
  });

  test('rejects probability > 1', () => {
    expect(validateProbabilities({ LOW: 0.3, MEDIUM: 1.5, HIGH: 0.2 })).toBe(false);
  });

  test('rejects non-numeric probability', () => {
    expect(validateProbabilities({ LOW: 'abc', MEDIUM: 0.5, HIGH: 0.2 })).toBe(false);
  });

  test('rejects malformed structure', () => {
    expect(validateProbabilities({ LOW: 0.3, MEDIUM: 0.5 })).toBe(false);
  });
});

// =========================================================================
// getMlPrediction — valid responses
// =========================================================================
describe('getMlPrediction — valid responses', () => {
  const features = makeFeatures({
    attendancePercentage: 80,
    averageScorePercentage: 70,
    averageEffortRating: 3,
    averageParticipationRating: 3,
    negativeFeedbackCount: 0,
  });

  test('valid LOW prediction', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'LOW',
      probabilities: { LOW: 0.8, MEDIUM: 0.15, HIGH: 0.05 },
      model: { name: 'logistic_regression', version: '1.0', featureVersion: '1.0' },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('READY');
    expect(result.prediction).toBe('LOW');
    expect(result.probabilities?.LOW).toBe(0.8);
    expect(result.modelVersion).toBe('1.0');
  });

  test('valid MEDIUM prediction', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'MEDIUM',
      probabilities: { LOW: 0.1, MEDIUM: 0.7, HIGH: 0.2 },
      model: { name: 'logistic_regression', version: '1.0' },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('READY');
    expect(result.prediction).toBe('MEDIUM');
  });

  test('valid HIGH prediction', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'HIGH',
      probabilities: { LOW: 0.05, MEDIUM: 0.15, HIGH: 0.8 },
      model: { name: 'logistic_regression', version: '1.0' },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('READY');
    expect(result.prediction).toBe('HIGH');
  });
});

// =========================================================================
// getMlPrediction — validation failures
// =========================================================================
describe('getMlPrediction — validation failures', () => {
  const features = makeFeatures({
    attendancePercentage: 80,
    averageScorePercentage: 70,
    averageEffortRating: 3,
    averageParticipationRating: 3,
    negativeFeedbackCount: 0,
  });

  test('invalid class → INVALID_PREDICTION', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'CRITICAL',
      probabilities: { LOW: 0.1, MEDIUM: 0.2, HIGH: 0.7 },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('INVALID_PREDICTION');
  });

  test('missing prediction → INVALID_PREDICTION', async () => {
    mockFetch({
      status: 'READY',
      probabilities: { LOW: 0.3, MEDIUM: 0.5, HIGH: 0.2 },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('INVALID_PREDICTION');
  });

  test('missing probabilities → INVALID_PROBABILITIES', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'LOW',
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('INVALID_PROBABILITIES');
  });

  test('probability < 0 → INVALID_PROBABILITIES', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'LOW',
      probabilities: { LOW: -0.1, MEDIUM: 0.6, HIGH: 0.5 },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('INVALID_PROBABILITIES');
  });

  test('probability > 1 → INVALID_PROBABILITIES', async () => {
    mockFetch({
      status: 'READY',
      prediction: 'LOW',
      probabilities: { LOW: 0.3, MEDIUM: 1.5, HIGH: 0.2 },
    });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('INVALID_PROBABILITIES');
  });

  test('malformed JSON response → MALFORMED_RESPONSE', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('Invalid JSON')),
    }) as any;
    const result = await getMlPrediction(features);
    expect(result.status).toBe('MALFORMED_RESPONSE');
  });
});

// =========================================================================
// getMlPrediction — service failures
// =========================================================================
describe('getMlPrediction — service failures', () => {
  const features = makeFeatures({
    attendancePercentage: 80,
    averageScorePercentage: 70,
    averageEffortRating: 3,
    averageParticipationRating: 3,
    negativeFeedbackCount: 0,
  });

  test('ML returns NOT_READY', async () => {
    mockFetch({ status: 'NOT_READY' });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('NOT_READY');
  });

  test('ML service unavailable (connection refused)', async () => {
    mockFetchError(new Error('fetch failed'));
    const result = await getMlPrediction(features);
    expect(result.status).toBe('UNAVAILABLE');
  });

  test('ML service timeout', async () => {
    mockFetchAbort();
    const result = await getMlPrediction(features);
    expect(result.status).toBe('TIMEOUT');
  });

  test('ML service returns 500 → UNAVAILABLE', async () => {
    mockFetch({ error: 'internal error' }, 500);
    const result = await getMlPrediction(features);
    expect(result.status).toBe('UNAVAILABLE');
  });

  test('ML returns ERROR status', async () => {
    mockFetch({ status: 'ERROR' });
    const result = await getMlPrediction(features);
    expect(result.status).toBe('ERROR');
  });
});
