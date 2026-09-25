import { logger } from '../utils/logger';
import { MlResult } from './risk/hybrid-decision';
import { RiskLevel } from './risk/rule-engine';
import { StudentFeatures } from './risk/feature-builder';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || '5000', 10);

const VALID_RISK_LEVELS: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

interface MlFeaturePayload {
  studentId: string;
  batchId: string;
  attendancePercentage: number;
  assessmentPercentage: number;
  averageEffortRating: number;
  averageParticipationRating: number;
  negativeFeedbackCount: number;
}

function buildPayload(features: StudentFeatures): MlFeaturePayload {
  return {
    studentId: features.studentId,
    batchId: features.batchId,
    attendancePercentage: features.attendance?.attendancePercentage ?? 0,
    assessmentPercentage: features.assessment?.averageScorePercentage ?? 0,
    averageEffortRating: features.feedback?.averageEffortRating ?? 0,
    averageParticipationRating: features.feedback?.averageParticipationRating ?? 0,
    negativeFeedbackCount: features.feedback?.negativeFeedbackCount ?? 0,
  };
}

function validatePrediction(prediction: unknown): prediction is RiskLevel {
  return typeof prediction === 'string' && VALID_RISK_LEVELS.includes(prediction as RiskLevel);
}

function validateProbabilities(
  probs: unknown,
): probs is { LOW: number; MEDIUM: number; HIGH: number } {
  if (probs === null || typeof probs !== 'object') return false;
  const p = probs as Record<string, unknown>;
  for (const key of ['LOW', 'MEDIUM', 'HIGH']) {
    const val = p[key];
    if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 1) return false;
  }
  return true;
}

export async function getMlPrediction(features: StudentFeatures): Promise<MlResult> {
  const payload = buildPayload(features);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${ML_SERVICE_URL}/api/risk/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      logger.warn('ML service returned non-OK status', {
        event: 'ml.http_error',
        status: response.status,
      });
      return { status: 'UNAVAILABLE' };
    }

    let body: any;
    try {
      body = await response.json();
    } catch {
      logger.warn('ML service returned malformed JSON', { event: 'ml.malformed_response' });
      return { status: 'MALFORMED_RESPONSE' };
    }

    if (body.status === 'NOT_READY') {
      return { status: 'NOT_READY' };
    }

    if (body.status === 'ERROR') {
      return { status: 'ERROR' };
    }

    if (body.status !== 'READY') {
      logger.warn('ML service returned unexpected status', {
        event: 'ml.unexpected_status',
        mlStatus: body.status,
      });
      return { status: 'ERROR' };
    }

    if (!validatePrediction(body.prediction)) {
      logger.warn('ML service returned invalid prediction', {
        event: 'ml.invalid_prediction',
        prediction: body.prediction,
      });
      return { status: 'INVALID_PREDICTION' };
    }

    if (!validateProbabilities(body.probabilities)) {
      logger.warn('ML service returned invalid probabilities', {
        event: 'ml.invalid_probabilities',
        probabilities: body.probabilities,
      });
      return { status: 'INVALID_PROBABILITIES' };
    }

    return {
      status: 'READY',
      modelVersion: body.model?.version,
      prediction: body.prediction as RiskLevel,
      confidence: body.probabilities[body.prediction as RiskLevel],
      probabilities: {
        LOW: body.probabilities.LOW,
        MEDIUM: body.probabilities.MEDIUM,
        HIGH: body.probabilities.HIGH,
      },
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.warn('ML service request timed out', { event: 'ml.timeout', timeoutMs: ML_TIMEOUT_MS });
      return { status: 'TIMEOUT' };
    }

    logger.warn('ML service unavailable', {
      event: 'ml.unavailable',
      error: err.message,
    });
    return { status: 'UNAVAILABLE' };
  }
}

export { buildPayload, validatePrediction, validateProbabilities };
