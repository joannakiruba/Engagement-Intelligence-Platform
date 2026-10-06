import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { registerForEventSchema } from '../validators/event-registrations.validator';
import {
  registerHandler,
  getMyRegistrationsHandler,
  listRegistrationsHandler,
  cancelRegistrationHandler,
} from '../controllers/event-registrations.controller';

const router = Router();

router.post('/', requirePermission('event_registrations:create:self'), validate(registerForEventSchema), registerHandler);
router.get('/my', requirePermission('event_registrations:read:own'), getMyRegistrationsHandler);
router.get('/', requirePermission('event_registrations:read:any'), listRegistrationsHandler);
router.delete('/:id', requirePermission('event_registrations:create:self'), cancelRegistrationHandler);

export default router;
