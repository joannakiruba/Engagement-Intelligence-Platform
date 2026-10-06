import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import {
  createFeedbackSchema,
  bulkCreateFeedbackSchema,
  updateFeedbackSchema,
} from '../validators/feedback.validator';
import {
  listFeedbackHandler,
  getFeedbackHandler,
  createFeedbackHandler,
  bulkCreateFeedbackHandler,
  updateFeedbackHandler,
  deleteFeedbackHandler,
} from '../controllers/feedback.controller';

const router = Router();

router.get('/', requirePermission('feedback:read:own_received', 'feedback:read:own_given', 'feedback:read:assigned', 'feedback:read:any'), listFeedbackHandler);

router.get('/:id', requirePermission('feedback:read:own_received', 'feedback:read:own_given', 'feedback:read:assigned', 'feedback:read:any'), getFeedbackHandler);

router.post('/', requirePermission('feedback:create:batch'), validate(createFeedbackSchema), createFeedbackHandler);

router.post('/bulk', requirePermission('feedback:create:batch'), validate(bulkCreateFeedbackSchema), bulkCreateFeedbackHandler);

router.put('/:id', requirePermission('feedback:create:batch'), validate(updateFeedbackSchema), updateFeedbackHandler);

router.delete('/:id', requirePermission('feedback:create:batch'), deleteFeedbackHandler);

export default router;
