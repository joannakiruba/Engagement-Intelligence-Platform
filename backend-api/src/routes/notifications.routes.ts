import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { listNotificationsSchema } from '../validators/notifications.validator';
import {
  listNotificationsHandler,
  markAsReadHandler,
  markAllAsReadHandler,
} from '../controllers/notifications.controller';

const router = Router();

router.get('/', requirePermission('notifications:read:own'), validate(listNotificationsSchema, 'query'), listNotificationsHandler);
router.patch('/:id/read', requirePermission('notifications:read:own'), markAsReadHandler);
router.post('/mark-all-read', requirePermission('notifications:read:own'), markAllAsReadHandler);

export default router;
