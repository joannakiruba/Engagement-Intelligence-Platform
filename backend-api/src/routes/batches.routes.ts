import { Router } from "express";
import { validate } from "../middleware/validate.middleware";
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
router.post("/", validate(createBatchSchema), createBatchHandler);
router.get("/", listBatchesHandler);
router.get("/:id", getBatchHandler);
router.put("/:id", validate(updateBatchSchema), updateBatchHandler);
router.delete("/:id", deleteBatchHandler);

// Roster (Students)
router.get("/:id/roster", getRosterHandler);
router.post("/:id/students", validate(assignStudentSchema), addStudentHandler);
router.delete("/:id/students/:studentId", removeStudentHandler);

// Trainers
router.get("/:id/trainers", getTrainersHandler);
router.post("/:id/trainers", validate(assignTrainerSchema), assignTrainerHandler);
router.delete("/:id/trainers/:trainerId", removeTrainerHandler);

// Batch-scoped sessions
router.get("/:id/sessions", listSessionsHandler);
router.post("/:id/sessions", validate(createSessionSchema), createSessionHandler);

export default router;
