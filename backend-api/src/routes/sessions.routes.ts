import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { updateSessionSchema } from "../validators/batches.validator";
import {
  getSessionHandler,
  updateSessionHandler,
  deleteSessionHandler,
} from "../controllers/batches.controller";

const router = Router();

router.get("/:id", getSessionHandler);
router.put("/:id", validate(updateSessionSchema), updateSessionHandler);
router.delete("/:id", deleteSessionHandler);

export default router;
