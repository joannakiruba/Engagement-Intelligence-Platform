import { Router } from 'express';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createInterventionSchema,
  updateInterventionSchema,
  interventionOutcomeSchema,
  interventionUpdateNoteSchema,
} from '../validators/interventions.validator';
import {
  createInterventionHandler,
  listInterventionsHandler,
  getInterventionHandler,
  updateInterventionHandler,
  addProgressNoteHandler,
  logOutcomeHandler,
} from '../controllers/interventions.controller';

const router = Router();

router.post('/', requirePermission('interventions:create:assigned'), validate(createInterventionSchema), createInterventionHandler);
router.get('/', requirePermission('interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'), listInterventionsHandler);
router.get('/:id', requirePermission('interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'), getInterventionHandler);
router.put('/:id', requirePermission('interventions:update:own'), validate(updateInterventionSchema), updateInterventionHandler);
router.post('/:id/updates', requirePermission('interventions:update:own'), validate(interventionUpdateNoteSchema), addProgressNoteHandler);
router.post('/:id/outcome', requirePermission('interventions:log_outcome:own'), validate(interventionOutcomeSchema), logOutcomeHandler);

export default router;
