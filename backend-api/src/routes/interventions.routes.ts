import { Router } from 'express';
import { requirePermission, resolveScope } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import * as ctrl from '../controllers/interventions.controller';
import {
  createInterventionSchema,
  updateInterventionSchema,
  completeInterventionSchema,
  editOutcomeSchema,
  createTaskSchema,
  updateTaskSchema,
  createNoteSchema,
  updateNoteSchema,
  listInterventionsSchema,
} from '../validators/interventions.validator';

const router = Router();

router.get(
  '/',
  requirePermission('interventions:read:any', 'interventions:read:assigned', 'interventions:read:own'),
  resolveScope('interventions:read'),
  validate(listInterventionsSchema, 'query'),
  ctrl.list,
);

router.get(
  '/pending-count',
  requirePermission('interventions:create:assigned'),
  ctrl.pendingCount,
);

router.get(
  '/alerts',
  requirePermission('interventions:create:assigned'),
  ctrl.getAlertsForMentor,
);

router.get(
  '/:id',
  requirePermission('interventions:read:any', 'interventions:read:assigned', 'interventions:read:own'),
  resolveScope('interventions:read'),
  ctrl.getById,
);

router.post(
  '/',
  requirePermission('interventions:create:assigned'),
  validate(createInterventionSchema),
  ctrl.create,
);

router.patch(
  '/:id',
  requirePermission('interventions:update:own'),
  validate(updateInterventionSchema),
  ctrl.update,
);

router.post(
  '/:id/complete',
  requirePermission('interventions:log_outcome:own'),
  validate(completeInterventionSchema),
  ctrl.complete,
);

router.patch(
  '/:id/outcome',
  requirePermission('interventions:log_outcome:own'),
  validate(editOutcomeSchema),
  ctrl.editOutcome,
);

// Tasks
router.post(
  '/:id/tasks',
  requirePermission('interventions:update:own'),
  validate(createTaskSchema),
  ctrl.createTask,
);

router.patch(
  '/:id/tasks/:taskId',
  requirePermission('interventions:update:own', 'tasks:update:own'),
  validate(updateTaskSchema),
  ctrl.updateTask,
);

// Notes (InterventionUpdate)
router.post(
  '/:id/notes',
  requirePermission('interventions:update:own'),
  validate(createNoteSchema),
  ctrl.createNote,
);

router.patch(
  '/:id/notes/:noteId',
  requirePermission('interventions:update:own'),
  validate(updateNoteSchema),
  ctrl.updateNote,
);

router.delete(
  '/:id/notes/:noteId',
  requirePermission('interventions:update:own'),
  ctrl.deleteNote,
);

export default router;
