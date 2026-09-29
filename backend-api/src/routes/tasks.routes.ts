import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTaskSchema, updateTaskSchema } from '../validators/tasks.validator';
import { createTaskHandler, updateTaskHandler, listTasksHandler, getTaskHandler } from '../controllers/tasks.controller';

const router = Router();

router.get(
  '/',
  requirePermission('tasks:read:batch', 'tasks:read:any'),
  listTasksHandler,
);

router.get(
  '/:id',
  requirePermission('tasks:read:batch', 'tasks:read:any'),
  getTaskHandler,
);

router.post(
  '/',
  requirePermission('tasks:create:batch', 'tasks:create:any'),
  validate(createTaskSchema),
  createTaskHandler,
);

router.put(
  '/:id',
  requirePermission('tasks:update:batch', 'tasks:update:any'),
  validate(updateTaskSchema),
  updateTaskHandler,
);

export default router;
