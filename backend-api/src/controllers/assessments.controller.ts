import { Request, Response, NextFunction } from "express";
import { parse } from "csv-parse/sync";
import { sendSuccess, sendError } from "../utils/response";
import {
  ServiceError,
  createAssessment,
  listAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  addSection,
  updateSection,
  deleteSection,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  submitQuestionScores,
  getResults,
  getStudentResult,
  bulkUploadScores,
} from "../services/assessments.service";
import { AssessmentType } from "@prisma/client";

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === "number")
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

export async function createAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createAssessment(req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listAssessmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { batchId?: string; type?: AssessmentType } = {};
    if (req.query.batchId) filters.batchId = String(req.query.batchId);
    if (req.query.type) filters.type = String(req.query.type) as AssessmentType;
    const result = await listAssessments(filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAssessmentById(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateAssessment(String(req.params.id), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteAssessmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteAssessment(String(req.params.id));
    return sendSuccess(res, { message: "Assessment deleted successfully" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addSectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await addSection(String(req.params.id), req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateSectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateSection(
      String(req.params.id),
      String(req.params.sectionId),
      req.body
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteSectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSection(String(req.params.id), String(req.params.sectionId));
    return sendSuccess(res, { message: "Section deleted successfully" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addQuestionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await addQuestion(
      String(req.params.id),
      String(req.params.sectionId),
      req.body
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateQuestionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateQuestion(
      String(req.params.id),
      String(req.params.questionId),
      req.body
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteQuestionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteQuestion(String(req.params.id), String(req.params.questionId));
    return sendSuccess(res, { message: "Question deleted successfully" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function submitScoresHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await submitQuestionScores(String(req.params.id), req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getResultsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getResults(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getStudentResultHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getStudentResult(
      String(req.params.id),
      String(req.params.studentId)
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function bulkUploadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      return sendError(res, "No file uploaded", 400);
    }

    const csvContent = req.file.buffer.toString("utf-8").trim();
    if (!csvContent) {
      return sendError(res, "Uploaded file is empty", 400);
    }

    let records: Record<string, string>[];
    try {
      records = parse(csvContent, {
        columns: (headers: string[]) => headers.map((h: string) => h.trim().toLowerCase()),
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
      });
    } catch {
      return sendError(res, "Failed to parse CSV file", 400);
    }

    if (records.length === 0) {
      return sendError(res, "CSV file contains no data rows", 400);
    }

    const headers = Object.keys(records[0]);
    const requiredHeaders = ["studentid", "questionid", "score"];
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return sendError(
        res,
        `Missing required CSV columns: ${missingHeaders.join(", ")}`,
        400
      );
    }

    const rows = records.map((r) => ({
      studentId: r.studentid,
      questionId: r.questionid,
      score: r.score,
    }));

    const result = await bulkUploadScores(String(req.params.id), rows);

    const statusCode = result.errors > 0 ? 207 : 200;
    return sendSuccess(res, result, statusCode);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
