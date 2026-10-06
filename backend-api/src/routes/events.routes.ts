import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createEventSchema,
  updateEventSchema,
  createRoundSchema,
  updateRoundSchema,
  setRegistrationStatusSchema,
} from '../validators/events.validator';
import {
  createEventHandler,
  updateEventHandler,
  closeEventHandler,
  reopenEventHandler,
  deleteEventHandler,
  addRoundHandler,
  updateRoundHandler,
  deleteRoundHandler,
  listEventsHandler,
  getEventHandler,
  studentEventsHandler,
  setStatusHandler,
  getRegistrationsHandler,
} from '../controllers/events.controller';

const router = Router();

// Student routes — GET /my-events must be registered before /:id
router.get(
  '/my-events',
  requirePermission('events:read:own', 'events:read:batch', 'events:read:any'),
  studentEventsHandler,
);

router.patch(
  '/:id/status',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  validate(setRegistrationStatusSchema),
  setStatusHandler,
);

// Trainer/admin list & detail
router.get(
  '/',
  requirePermission('events:read:batch', 'events:read:any'),
  listEventsHandler,
);

router.get(
  '/:id',
  requirePermission('events:read:own', 'events:read:batch', 'events:read:any'),
  getEventHandler,
);

// CRUD
router.post(
  '/',
  requirePermission('events:create:batch', 'events:create:any'),
  validate(createEventSchema),
  createEventHandler,
);

router.put(
  '/:id',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  validate(updateEventSchema),
  updateEventHandler,
);

router.delete(
  '/:id',
  requirePermission('events:delete:batch', 'events:delete:any'),
  deleteEventHandler,
);

// Close/Reopen
router.post(
  '/:id/close',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  closeEventHandler,
);

router.post(
  '/:id/reopen',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  reopenEventHandler,
);

// Rounds
router.post(
  '/:id/rounds',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  validate(createRoundSchema),
  addRoundHandler,
);

router.put(
  '/:id/rounds/:roundId',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  validate(updateRoundSchema),
  updateRoundHandler,
);

router.delete(
  '/:id/rounds/:roundId',
  requirePermission('events:update:own', 'events:update:batch', 'events:update:any'),
  deleteRoundHandler,
);

// Registrations
router.get(
  '/:id/registrations',
  requirePermission('events:read:batch', 'events:read:any'),
  getRegistrationsHandler,
);

export default router;
