import { Router } from "express";
import multer from "multer";
import { validate } from "../middleware/validate.middleware";
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
router.post("/", validate(createAssessmentSchema), createAssessmentHandler);
router.get("/", listAssessmentsHandler);
router.get("/:id", getAssessmentHandler);
router.put("/:id", validate(updateAssessmentSchema), updateAssessmentHandler);
router.delete("/:id", deleteAssessmentHandler);

// Section management
router.post("/:id/sections", validate(addSectionSchema), addSectionHandler);
router.put("/:id/sections/:sectionId", validate(updateSectionSchema), updateSectionHandler);
router.delete("/:id/sections/:sectionId", deleteSectionHandler);

// Question management
router.post(
  "/:id/sections/:sectionId/questions",
  validate(addQuestionSchema),
  addQuestionHandler
);
router.put("/:id/questions/:questionId", validate(updateQuestionSchema), updateQuestionHandler);
router.delete("/:id/questions/:questionId", deleteQuestionHandler);

// Score submission
router.post("/:id/scores", validate(submitScoresSchema), submitScoresHandler);

// Results
router.get("/:id/results", getResultsHandler);
router.get("/:id/results/:studentId", getStudentResultHandler);

// Bulk CSV upload
router.post("/:id/scores/bulk", upload.single("file"), bulkUploadHandler);

export default router;
