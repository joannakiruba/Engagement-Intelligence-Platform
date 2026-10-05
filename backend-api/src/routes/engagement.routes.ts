import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
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

router.get('/dashboard', validate(dateRangeQuerySchema, 'query'), dashboardHandler);

router.get('/batch/:batchId/trends', validate(batchParamsSchema, 'params'), validate(dateRangeQuerySchema, 'query'), batchTrendsHandler);

router.get('/batch/:batchId', validate(batchParamsSchema, 'params'), validate(dateRangeQuerySchema, 'query'), batchEngagementHandler);

router.get('/student/:studentId', validate(studentParamsSchema, 'params'), validate(studentQuerySchema, 'query'), studentEngagementHandler);

export default router;
