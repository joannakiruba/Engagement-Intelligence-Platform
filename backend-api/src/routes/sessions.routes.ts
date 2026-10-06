import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { requirePermission } from "../auth/rbac.middleware";
import { updateSessionSchema } from "../validators/batches.validator";
import {
  getSessionHandler,
  updateSessionHandler,
  deleteSessionHandler,
} from "../controllers/batches.controller";

const router = Router();

router.get("/:id", requirePermission('sessions:read:own', 'sessions:read:assigned', 'sessions:read:any'), getSessionHandler);
router.put("/:id", requirePermission('sessions:update:batch'), validate(updateSessionSchema), updateSessionHandler);
router.delete("/:id", requirePermission('sessions:update:batch'), deleteSessionHandler);

export default router;
