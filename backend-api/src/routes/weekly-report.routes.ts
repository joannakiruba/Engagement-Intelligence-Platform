import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission, resolveScope } from '../auth/rbac.middleware';
import {
  triggerBodySchema,
} from '../validators/weekly-report.validator';
import {
  previewWeeklyReportHandler,
  triggerWeeklyReportsHandler,
  getScheduleHandler,
} from '../controllers/weekly-report.controller';

const router = Router();

router.get(
  '/preview',
  requirePermission(
    'weekly_reports:read:assigned',
    'weekly_reports:read:any',
  ),
  resolveScope('weekly_reports:read'),
  previewWeeklyReportHandler,
);

router.post(
  '/trigger',
  requirePermission('weekly_reports:trigger'),
  validate(triggerBodySchema),
  triggerWeeklyReportsHandler,
);

router.get(
  '/schedule',
  requirePermission(
    'weekly_reports:read:assigned',
    'weekly_reports:read:any',
  ),
  getScheduleHandler,
);

export default router;
