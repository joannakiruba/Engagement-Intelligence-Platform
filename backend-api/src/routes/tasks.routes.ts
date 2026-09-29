import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createTaskSchema,
  updateTaskSchema,
  changeDeadlineSchema,
  updateProgressSchema,
  addStudentSchema,
  setMarksSchema,
  bulkSetMarksSchema,
} from '../validators/tasks.validator';
import {
  createTaskHandler,
  updateTaskHandler,
  listTasksHandler,
  getTaskHandler,
  changeDeadlineHandler,
  closeTaskHandler,
  reopenTaskHandler,
  deleteTaskHandler,
  studentTasksHandler,
  updateProgressHandler,
  toggleInterestedHandler,
  addStudentHandler,
  setMarksHandler,
  bulkSetMarksHandler,
  exportMarksHandler,
} from '../controllers/tasks.controller';

const router = Router();

// Student routes (must come before /:id to avoid matching)
router.get(
  '/my-tasks',
  requirePermission('tasks:read:own'),
  studentTasksHandler,
);

// Trainer/admin task CRUD
router.get(
  '/',
  requirePermission('tasks:read:batch', 'tasks:read:any'),
  listTasksHandler,
);

router.get(
  '/:id',
  requirePermission('tasks:read:batch', 'tasks:read:any', 'tasks:read:own'),
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

router.delete(
  '/:id',
  requirePermission('tasks:delete:batch', 'tasks:delete:any'),
  deleteTaskHandler,
);

// Deadline
router.patch(
  '/:id/deadline',
  requirePermission('tasks:update:batch', 'tasks:update:any'),
  validate(changeDeadlineSchema),
  changeDeadlineHandler,
);

// Close / reopen
router.post(
  '/:id/close',
  requirePermission('tasks:update:batch', 'tasks:update:any'),
  closeTaskHandler,
);

router.post(
  '/:id/reopen',
  requirePermission('tasks:update:batch', 'tasks:update:any'),
  reopenTaskHandler,
);

// Student progress & interest
router.patch(
  '/:id/progress',
  requirePermission('tasks:update:own'),
  validate(updateProgressSchema),
  updateProgressHandler,
);

router.post(
  '/:id/interested',
  requirePermission('tasks:update:own'),
  toggleInterestedHandler,
);

// Manual student add (trainer)
router.post(
  '/:id/students',
  requirePermission('tasks:update:batch', 'tasks:update:any'),
  validate(addStudentSchema),
  addStudentHandler,
);

// Marks
router.put(
  '/:id/marks',
  requirePermission('tasks:grade:batch', 'tasks:grade:any'),
  validate(setMarksSchema),
  setMarksHandler,
);

router.post(
  '/:id/marks/bulk',
  requirePermission('tasks:grade:batch', 'tasks:grade:any'),
  validate(bulkSetMarksSchema),
  bulkSetMarksHandler,
);

router.get(
  '/:id/marks/export',
  requirePermission('tasks:grade:batch', 'tasks:grade:any'),
  exportMarksHandler,
);

export default router;
