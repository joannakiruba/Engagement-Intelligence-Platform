import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { MlResult } from './risk/hybrid-decision';
import { RiskLevel } from './risk/rule-engine';
import { StudentFeatures } from './risk/feature-builder';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || '';
const ML_SERVICE_AUDIENCE = process.env.ML_SERVICE_AUDIENCE || ML_SERVICE_URL;
const ML_SERVICE_AUTH_MODE = process.env.ML_SERVICE_AUTH_MODE
  || (config.isProduction ? 'cloudrun' : 'none');
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || '5000', 10);

let cachedMlIdToken: string | null = null;
let cachedMlIdTokenExpiresAt = 0;
let mlIdTokenRequest: Promise<string> | null = null;

async function getMlAuthorizationHeaders(): Promise<Record<string, string>> {
  if (!ML_SERVICE_URL) throw new Error('ML_SERVICE_URL must be configured');
  if (ML_SERVICE_AUTH_MODE === 'none') return {};
  if (ML_SERVICE_AUTH_MODE !== 'cloudrun') {
    throw new Error(`Unsupported ML_SERVICE_AUTH_MODE: ${ML_SERVICE_AUTH_MODE}`);
  }
  if (!config.isProduction) return {};
  if (!ML_SERVICE_AUDIENCE) throw new Error('ML_SERVICE_AUDIENCE must be configured');
  if (cachedMlIdToken && cachedMlIdTokenExpiresAt > Date.now()) {
    return { Authorization: `Bearer ${cachedMlIdToken}` };
  }

  if (!mlIdTokenRequest) {
    const metadataUrl = new URL(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity',
    );
    metadataUrl.searchParams.set('audience', ML_SERVICE_AUDIENCE);
    mlIdTokenRequest = fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(3000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Cloud Run metadata server returned ${response.status}`);
      const token = await response.text();
      const payload = token.split('.')[1];
      if (!payload) throw new Error('Cloud Run metadata server returned an invalid ID token');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number };
      cachedMlIdTokenExpiresAt = typeof claims.exp === 'number'
        ? claims.exp * 1000 - 60_000
        : Date.now() + 50 * 60_000;
      cachedMlIdToken = token;
      return token;
    }).finally(() => {
      mlIdTokenRequest = null;
    });
  }

  return { Authorization: `Bearer ${await mlIdTokenRequest}` };
}

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
        headers: { 'Content-Type': 'application/json', ...await getMlAuthorizationHeaders() },
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

// ── Smart Mentor Alert client (Module 14) ──

export interface MentorAlert {
  student_id: string;
  student_name: string;
  mentor_id: string;
  mentor_name: string;
  batch_id: string | null;
  batch_name: string | null;
  priority_score: number;
  urgency_tier: 'CRITICAL' | 'HIGH' | 'MODERATE';
  trigger_reason: string;
  risk_score: number;
  risk_velocity: number;
  recommended_intervention: string;
  recommendation_confidence: number;
  recommendation_reasoning: string;
  contributing_factors: Array<{ factor: string; value: number | string; impact: number; detail: string }>;
  created_at: string;
}

export interface GenerateAlertsResponse {
  total_students_analyzed: number;
  alerts_generated: number;
  alerts_filtered: number;
  alerts: MentorAlert[];
}

export interface AlertStats {
  total_alerts: number;
  critical_count: number;
  high_count: number;
  moderate_count: number;
  avg_response_time_hours: number | null;
  acted_rate: number;
  recommendation_follow_rate: number;
}

export async function generateMentorAlerts(batchId?: string): Promise<GenerateAlertsResponse> {
  try {
    const response = await axios.post<GenerateAlertsResponse>(
      `${ML_SERVICE_URL}/api/ml/mentor-alerts/generate`, { batch_id: batchId || null },
      { headers: await getMlAuthorizationHeaders() });
    return response.data;
  } catch (error) {
    logger.error('Failed to generate mentor alerts from ML service', error);
    throw new Error('ML service unavailable');
  }
}

export async function getMentorAlerts(mentorId: string): Promise<MentorAlert[]> {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/api/ml/mentor-alerts/mentor/${mentorId}`, {
      headers: await getMlAuthorizationHeaders(),
    });
    return response.data.data;
  } catch (error) {
    logger.error('Failed to fetch mentor alerts', error);
    throw new Error('ML service unavailable');
  }
}

export async function getStudentAlerts(studentId: string): Promise<MentorAlert[]> {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/api/ml/mentor-alerts/student/${studentId}`, {
      headers: await getMlAuthorizationHeaders(),
    });
    return response.data.data;
  } catch (error) {
    logger.error('Failed to fetch student alerts', error);
    throw new Error('ML service unavailable');
  }
}

export async function updateAlertStatus(alertId: number, status: string): Promise<unknown> {
  try {
    const response = await axios.put(`${ML_SERVICE_URL}/api/ml/mentor-alerts/${alertId}/status`, null, {
      params: { status },
      headers: await getMlAuthorizationHeaders(),
    });
    return response.data.data;
  } catch (error) {
    logger.error('Failed to update alert status', error);
    throw new Error('ML service unavailable');
  }
}

export async function recordAlertOutcome(alertId: number, data: {
  mentor_response: string; response_time_hours?: number; intervention_id?: string;
  was_recommendation_followed: boolean; outcome_notes?: string;
}): Promise<unknown> {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/api/ml/mentor-alerts/${alertId}/outcome`, null, {
      params: data,
      headers: await getMlAuthorizationHeaders(),
    });
    return response.data.data;
  } catch (error) {
    logger.error('Failed to record alert outcome', error);
    throw new Error('ML service unavailable');
  }
}

export async function getAlertStats(): Promise<AlertStats> {
  try {
    const response = await axios.get<AlertStats>(`${ML_SERVICE_URL}/api/ml/mentor-alerts/stats`, {
      headers: await getMlAuthorizationHeaders(),
    });
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch alert stats', error);
    throw new Error('ML service unavailable');
  }
}
