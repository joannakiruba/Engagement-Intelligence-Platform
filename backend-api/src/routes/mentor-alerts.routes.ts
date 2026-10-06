import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { generateAlertsSchema, updateAlertStatusSchema, alertOutcomeSchema } from '../validators/mentor-alerts.validator';
import {
  generateAlertsHandler,
  getMentorAlertsHandler,
  getStudentAlertsHandler,
  updateAlertStatusHandler,
  recordAlertOutcomeHandler,
  getAlertStatsHandler,
} from '../controllers/mentor-alerts.controller';

const router = Router();

router.post('/generate', requirePermission('risk_scores:calculate:batch', 'risk_scores:calculate:any'), validate(generateAlertsSchema), generateAlertsHandler);
router.get('/mentor/:mentorId', requirePermission('interventions:read:assigned', 'interventions:read:any'), getMentorAlertsHandler);
router.get('/student/:studentId', requirePermission('risk_scores:read:own', 'risk_scores:read:assigned', 'risk_scores:read:any'), getStudentAlertsHandler);
router.put('/:alertId/status', requirePermission('interventions:update:own', 'interventions:read:any'), validate(updateAlertStatusSchema), updateAlertStatusHandler);
router.post('/:alertId/outcome', requirePermission('interventions:log_outcome:own', 'interventions:read:any'), validate(alertOutcomeSchema), recordAlertOutcomeHandler);
router.get('/stats', requirePermission('risk_scores:read:any'), getAlertStatsHandler);

export default router;
