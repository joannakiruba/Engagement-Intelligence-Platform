import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import { sendSuccess, sendError } from '../utils/response';
import {
  generateMentorAlerts, getMentorAlerts, getStudentAlerts,
  updateAlertStatus, recordAlertOutcome, getAlertStats,
} from '../services/ml.service';

const router = Router();

const generateSchema = Joi.object({ batchId: Joi.string().uuid().optional() });
const updateStatusSchema = Joi.object({ status: Joi.string().valid('pending', 'seen', 'acted', 'dismissed').required() });
const outcomeSchema = Joi.object({
  mentor_response: Joi.string().valid('acted', 'dismissed', 'ignored').required(),
  response_time_hours: Joi.number().positive().optional(),
  intervention_id: Joi.string().uuid().optional(),
  was_recommendation_followed: Joi.boolean().required(),
  outcome_notes: Joi.string().max(1000).optional(),
});

router.post('/generate', requirePermission('risk_scores:calculate:batch', 'risk_scores:calculate:any'), validate(generateSchema), async (req: Request, res: Response): Promise<void> => {
  try { const result = await generateMentorAlerts(req.body.batchId); sendSuccess(res, result, 201); }
  catch (err) { sendError(res, 'Failed to generate mentor alerts. ML service may be unavailable.', 503); }
});

router.get('/mentor/:mentorId', requirePermission('interventions:read:assigned', 'interventions:read:any'), async (req: Request, res: Response): Promise<void> => {
  try { const mentorId = Array.isArray(req.params.mentorId) ? req.params.mentorId[0] : req.params.mentorId;
    const alerts = await getMentorAlerts(mentorId); sendSuccess(res, alerts); }
  catch (err) { sendError(res, 'Failed to fetch mentor alerts.', 503); }
});

router.get('/student/:studentId', requirePermission('risk_scores:read:own', 'risk_scores:read:assigned', 'risk_scores:read:any'), async (req: Request, res: Response): Promise<void> => {
  try { const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
    const alerts = await getStudentAlerts(studentId); sendSuccess(res, alerts); }
  catch (err) { sendError(res, 'Failed to fetch student alerts.', 503); }
});

router.put('/:alertId/status', requirePermission('interventions:update:own', 'interventions:read:any'), validate(updateStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try { const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
    if (isNaN(alertId)) { sendError(res, 'Invalid alert ID.', 400); return; }
    const updated = await updateAlertStatus(alertId, req.body.status); sendSuccess(res, updated); }
  catch (err) { sendError(res, 'Failed to update alert status.', 503); }
});

router.post('/:alertId/outcome', requirePermission('interventions:log_outcome:own', 'interventions:read:any'), validate(outcomeSchema), async (req: Request, res: Response): Promise<void> => {
  try { const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
    if (isNaN(alertId)) { sendError(res, 'Invalid alert ID.', 400); return; }
    const result = await recordAlertOutcome(alertId, req.body); sendSuccess(res, result, 201); }
  catch (err) { sendError(res, 'Failed to record alert outcome.', 503); }
});

router.get('/stats', requirePermission('risk_scores:read:any'), async (_req: Request, res: Response): Promise<void> => {
  try { const stats = await getAlertStats(); sendSuccess(res, stats); }
  catch (err) { sendError(res, 'Failed to fetch alert statistics.', 503); }
});

export default router;
