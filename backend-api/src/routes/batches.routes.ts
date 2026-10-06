import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
import { requirePermission, resolveScope } from "../auth/rbac.middleware";
import {
  createBatchSchema,
  updateBatchSchema,
  assignStudentSchema,
  assignTrainerSchema,
  createSessionSchema,
} from "../validators/batches.validator";
import {
  createBatchHandler,
  listBatchesHandler,
  getBatchHandler,
  updateBatchHandler,
  deleteBatchHandler,
  getRosterHandler,
  addStudentHandler,
  removeStudentHandler,
  getTrainersHandler,
  assignTrainerHandler,
  removeTrainerHandler,
  listSessionsHandler,
  createSessionHandler,
} from "../controllers/batches.controller";

const router = Router();

// Batch CRUD
router.post("/", requirePermission('batches:create'), validate(createBatchSchema), createBatchHandler);
router.get("/", requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), resolveScope('batches:read'), listBatchesHandler);
router.get("/:id", requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), getBatchHandler);
router.put("/:id", requirePermission('batches:update:any'), validate(updateBatchSchema), updateBatchHandler);
router.delete("/:id", requirePermission('batches:update:any'), deleteBatchHandler);

// Roster (Students)
router.get("/:id/roster", requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), getRosterHandler);
router.post("/:id/students", requirePermission('batches:update:any'), validate(assignStudentSchema), addStudentHandler);
router.delete("/:id/students/:studentId", requirePermission('batches:update:any'), removeStudentHandler);

// Trainers
router.get("/:id/trainers", requirePermission('batches:read:own', 'batches:read:assigned', 'batches:read:any'), getTrainersHandler);
router.post("/:id/trainers", requirePermission('batches:update:any'), validate(assignTrainerSchema), assignTrainerHandler);
router.delete("/:id/trainers/:trainerId", requirePermission('batches:update:any'), removeTrainerHandler);

// Batch-scoped sessions
router.get("/:id/sessions", requirePermission('sessions:read:own', 'sessions:read:assigned', 'sessions:read:any'), listSessionsHandler);
router.post("/:id/sessions", requirePermission('sessions:create:batch'), validate(createSessionSchema), createSessionHandler);

export default router;
