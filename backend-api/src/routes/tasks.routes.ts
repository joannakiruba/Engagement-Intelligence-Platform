import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTaskSchema, updateTaskSchema } from '../validators/tasks.validator';
import { createTaskHandler, updateTaskHandler } from '../controllers/tasks.controller';

const router = Router();

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
