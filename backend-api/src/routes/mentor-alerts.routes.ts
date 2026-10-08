import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import { sendSuccess, sendError } from '../utils/response';
import {
  generateMentorAlerts, getMentorAlerts, getStudentAlerts,
  updateAlertStatus, recordAlertOutcome, getAlertStats,
} from '../services/ml.service';
import prisma from '../lib/prisma';

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

async function verifyMentorOwnsAlert(alertId: number, mentorId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; mentor_id: string }>>(
    `SELECT id, mentor_id FROM ml_mentor_alerts WHERE id = $1`,
    alertId,
  );
  if (!rows.length) return false;
  return rows[0].mentor_id === mentorId;
}

async function verifyMentorAssignment(mentorId: string, studentId: string) {
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { mentorId_studentId: { mentorId, studentId } },
  });
  return !!assignment;
}

router.post(
  '/generate',
  requirePermission('risk_scores:calculate:any', 'risk_scores:calculate:batch'),
  validate(generateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { const result = await generateMentorAlerts(req.body.batchId); sendSuccess(res, result, 201); }
    catch (err) { next(err); }
  },
);

router.get(
  '/mentor/:mentorId',
  requirePermission('interventions:read:assigned', 'interventions:read:any'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const mentorId = Array.isArray(req.params.mentorId) ? req.params.mentorId[0] : req.params.mentorId;
      const userId = req.user!.sub;

      const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
      const hasReadAny = heldPermissions.has('interventions:read:any');
      if (!hasReadAny && mentorId !== userId) {
        sendError(res, 'Access denied.', 403);
        return;
      }

      const alerts = await getMentorAlerts(mentorId);
      sendSuccess(res, alerts);
    } catch (err) { next(err); }
  },
);

router.get(
  '/student/:studentId',
  requirePermission('interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const studentId = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
      const userId = req.user!.sub;

      const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
      const hasReadAny = heldPermissions.has('interventions:read:any');
      const hasReadAssigned = heldPermissions.has('interventions:read:assigned');

      if (!hasReadAny) {
        if (hasReadAssigned) {
          const isAssigned = await verifyMentorAssignment(userId, studentId);
          if (!isAssigned) { sendError(res, 'Access denied.', 403); return; }
        } else if (studentId !== userId) {
          sendError(res, 'Access denied.', 403);
          return;
        }
      }

      const alerts = await getStudentAlerts(studentId);
      sendSuccess(res, alerts);
    } catch (err) { next(err); }
  },
);

router.put(
  '/:alertId/status',
  requirePermission('interventions:create:assigned', 'interventions:read:any'),
  validate(updateStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
      if (isNaN(alertId)) { sendError(res, 'Invalid alert ID.', 400); return; }

      const userId = req.user!.sub;
      const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
      const hasReadAny = heldPermissions.has('interventions:read:any');

      if (!hasReadAny) {
        const owns = await verifyMentorOwnsAlert(alertId, userId);
        if (!owns) { sendError(res, 'Alert not found.', 404); return; }
      }

      if (req.body.status === 'dismissed') {
        const activeInterventions = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM interventions WHERE "alertId" = $1 AND status IN ('PENDING', 'IN_PROGRESS') LIMIT 1`,
          alertId,
        );
        if (activeInterventions.length) {
          sendError(res, 'This alert has an active intervention and cannot be dismissed.', 409);
          return;
        }
      }

      const updated = await updateAlertStatus(alertId, req.body.status);
      sendSuccess(res, updated);
    } catch (err) { next(err); }
  },
);

router.post(
  '/:alertId/outcome',
  requirePermission('interventions:create:assigned'),
  validate(outcomeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alertId = parseInt(Array.isArray(req.params.alertId) ? req.params.alertId[0] : req.params.alertId, 10);
      if (isNaN(alertId)) { sendError(res, 'Invalid alert ID.', 400); return; }

      const userId = req.user!.sub;
      const owns = await verifyMentorOwnsAlert(alertId, userId);
      if (!owns) { sendError(res, 'Alert not found.', 404); return; }

      const result = await recordAlertOutcome(alertId, req.body);
      sendSuccess(res, result, 201);
    } catch (err) { next(err); }
  },
);

router.get(
  '/stats',
  requirePermission('interventions:read:any'),
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { const stats = await getAlertStats(); sendSuccess(res, stats); }
    catch (err) { next(err); }
  },
);

export default router;
