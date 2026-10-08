import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import { getTrainingHistorySchema } from '../validators/training-history.validator';
import { getMyTrainingHistoryHandler } from '../controllers/training-history.controller';

const router = Router();

// Get authenticated student's training history
// Combines session attendance and assessment results into chronological timeline
router.get(
  '/',
  requirePermission('sessions:read:own', 'assessments:read:own'),
  validate(getTrainingHistorySchema),
  getMyTrainingHistoryHandler
);

export default router;
