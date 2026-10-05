import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import {
  dateRangeQuerySchema,
  batchParamsSchema,
  studentParamsSchema,
  studentQuerySchema,
} from '../validators/engagement.validator';
import {
  dashboardHandler,
  batchEngagementHandler,
  studentEngagementHandler,
  batchTrendsHandler,
} from '../controllers/engagement.controller';

const router = Router();

router.get('/dashboard', requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), validate(dateRangeQuerySchema, 'query'), dashboardHandler);

router.get('/batch/:batchId/trends', requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), validate(batchParamsSchema, 'params'), validate(dateRangeQuerySchema, 'query'), batchTrendsHandler);

router.get('/batch/:batchId', requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), validate(batchParamsSchema, 'params'), validate(dateRangeQuerySchema, 'query'), batchEngagementHandler);

router.get('/student/:studentId', requirePermission('attendance:read:own', 'attendance:read:batch', 'attendance:read:assigned', 'attendance:read:any'), validate(studentParamsSchema, 'params'), validate(studentQuerySchema, 'query'), studentEngagementHandler);

export default router;
