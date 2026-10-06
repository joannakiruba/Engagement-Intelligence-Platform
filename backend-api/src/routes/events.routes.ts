import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createEventSchema, updateEventSchema } from '../validators/events.validator';
import {
  listEventsHandler,
  getEventHandler,
  createEventHandler,
  updateEventHandler,
} from '../controllers/events.controller';

const router = Router();

router.get('/', requirePermission('events:read:any'), listEventsHandler);
router.get('/:id', requirePermission('events:read:any'), getEventHandler);
router.post('/', requirePermission('events:create'), validate(createEventSchema), createEventHandler);
router.put('/:id', requirePermission('events:update:any'), validate(updateEventSchema), updateEventHandler);

export default router;
