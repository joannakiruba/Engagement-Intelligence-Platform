import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { createAssignmentSchema } from '../validators/mentor-assignments.validator';
import {
  listAssignmentsHandler,
  getAssignmentHandler,
  createAssignmentHandler,
  deleteAssignmentHandler,
} from '../controllers/mentor-assignments.controller';

const router = Router();

router.get('/', requirePermission('mentor_assignments:read:own', 'mentor_assignments:read:any'), listAssignmentsHandler);
router.get('/:id', requirePermission('mentor_assignments:read:own', 'mentor_assignments:read:any'), getAssignmentHandler);
router.post('/', requirePermission('mentor_assignments:create'), validate(createAssignmentSchema), createAssignmentHandler);
router.delete('/:id', requirePermission('mentor_assignments:create'), deleteAssignmentHandler);

export default router;
