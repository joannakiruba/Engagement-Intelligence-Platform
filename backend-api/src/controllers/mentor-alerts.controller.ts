import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  generateMentorAlerts,
  getMentorAlerts,
  getStudentAlerts,
  updateAlertStatus,
  recordAlertOutcome,
  getAlertStats,
} from '../services/ml.service';

export async function generateAlertsHandler(req: Request, res: Response): Promise<void> {
  try {
    const result = await generateMentorAlerts(req.body.batchId);
    sendSuccess(res, result, 201);
  } catch (err) {
    sendError(res, 'Failed to generate mentor alerts. ML service may be unavailable.', 503);
  }
}

export async function getMentorAlertsHandler(req: Request, res: Response): Promise<void> {
  try {
    const mentorId = Array.isArray(req.params.mentorId) ? req.params.mentorId[0] : req.params.mentorId;
    const alerts = await getMentorAlerts(mentorId);
    sendSuccess(res, alerts);
  } catch (err) {
    sendError(res, 'Failed to fetch mentor alerts.', 503);
  }
}

export async function getStudentAlertsHandler(req: Request, res: Response): Promise<void> {
  try {
    const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
    const alerts = await getStudentAlerts(studentId);
    sendSuccess(res, alerts);
  } catch (err) {
    sendError(res, 'Failed to fetch student alerts.', 503);
  }
}

export async function updateAlertStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
    if (isNaN(alertId)) {
      sendError(res, 'Invalid alert ID.', 400);
      return;
    }
    const updated = await updateAlertStatus(alertId, req.body.status);
    sendSuccess(res, updated);
  } catch (err) {
    sendError(res, 'Failed to update alert status.', 503);
  }
}

export async function recordAlertOutcomeHandler(req: Request, res: Response): Promise<void> {
  try {
    const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
    if (isNaN(alertId)) {
      sendError(res, 'Invalid alert ID.', 400);
      return;
    }
    const result = await recordAlertOutcome(alertId, req.body);
    sendSuccess(res, result, 201);
  } catch (err) {
    sendError(res, 'Failed to record alert outcome.', 503);
  }
}

export async function getAlertStatsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await getAlertStats();
    sendSuccess(res, stats);
  } catch (err) {
    sendError(res, 'Failed to fetch alert statistics.', 503);
  }
}
