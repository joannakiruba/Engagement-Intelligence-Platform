import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createTaskSchema } from '../validators/tasks.validator';
import { createTaskHandler } from '../controllers/tasks.controller';

const router = Router();

router.post(
  '/',
  requirePermission('tasks:create:batch', 'tasks:create:any'),
  validate(createTaskSchema),
  createTaskHandler,
);

export default router;
