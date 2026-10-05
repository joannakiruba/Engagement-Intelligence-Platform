import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.middleware";
import { requirePermission } from "../auth/rbac.middleware";
import {
  createAssessmentSchema,
  updateAssessmentSchema,
  addSectionSchema,
  updateSectionSchema,
  addQuestionSchema,
  updateQuestionSchema,
  submitScoresSchema,
} from "../validators/assessments.validator";
import {
  createAssessmentHandler,
  listAssessmentsHandler,
  getAssessmentHandler,
  updateAssessmentHandler,
  deleteAssessmentHandler,
  addSectionHandler,
  updateSectionHandler,
  deleteSectionHandler,
  addQuestionHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  submitScoresHandler,
  getResultsHandler,
  getStudentResultHandler,
  bulkUploadHandler,
} from "../controllers/assessments.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Assessment CRUD
router.post("/", requirePermission('assessments:create:batch'), validate(createAssessmentSchema), createAssessmentHandler);
router.get("/", requirePermission('assessments:read:own', 'assessments:read:batch', 'assessments:read:assigned', 'assessments:read:any'), listAssessmentsHandler);
router.get("/:id", requirePermission('assessments:read:own', 'assessments:read:batch', 'assessments:read:assigned', 'assessments:read:any'), getAssessmentHandler);
router.put("/:id", requirePermission('assessments:update:batch', 'assessments:update:any'), validate(updateAssessmentSchema), updateAssessmentHandler);
router.delete("/:id", requirePermission('assessments:update:batch', 'assessments:update:any'), deleteAssessmentHandler);

// Section management
router.post("/:id/sections", requirePermission('assessments:create:batch'), validate(addSectionSchema), addSectionHandler);
router.put("/:id/sections/:sectionId", requirePermission('assessments:update:batch', 'assessments:update:any'), validate(updateSectionSchema), updateSectionHandler);
router.delete("/:id/sections/:sectionId", requirePermission('assessments:update:batch', 'assessments:update:any'), deleteSectionHandler);

// Question management
router.post(
  "/:id/sections/:sectionId/questions",
  requirePermission('assessments:create:batch'),
  validate(addQuestionSchema),
  addQuestionHandler
);
router.put("/:id/questions/:questionId", requirePermission('assessments:update:batch', 'assessments:update:any'), validate(updateQuestionSchema), updateQuestionHandler);
router.delete("/:id/questions/:questionId", requirePermission('assessments:update:batch', 'assessments:update:any'), deleteQuestionHandler);

// Score submission
router.post("/:id/scores", requirePermission('assessments:create:batch'), validate(submitScoresSchema), submitScoresHandler);

// Results
router.get("/:id/results", requirePermission('assessments:read:own', 'assessments:read:batch', 'assessments:read:assigned', 'assessments:read:any'), getResultsHandler);
router.get("/:id/results/:studentId", requirePermission('assessments:read:own', 'assessments:read:batch', 'assessments:read:assigned', 'assessments:read:any'), getStudentResultHandler);

// Bulk CSV upload
router.post("/:id/scores/bulk", requirePermission('assessments:create:batch'), upload.single("file"), bulkUploadHandler);

export default router;
