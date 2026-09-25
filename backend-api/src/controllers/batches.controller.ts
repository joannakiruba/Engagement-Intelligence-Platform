import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendError } from "../utils/response";
import {
  ServiceError,
  createBatch,
  listBatches,
  getBatchById,
  updateBatch,
  deleteBatch,
  getRoster,
  addStudent,
  removeStudent,
  getTrainers,
  assignTrainer,
  removeTrainer,
  listSessions,
  createSession,
  getSessionById,
  updateSession,
  deleteSession,
} from "../services/batches.service";

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === "number")
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

// --- Batch CRUD ---

export async function createBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createBatch(req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listBatchesHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listBatches();
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getBatchById(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateBatch(String(req.params.id), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteBatchHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteBatch(String(req.params.id));
    return sendSuccess(res, { message: "Batch deleted successfully" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

// --- Roster (Students) ---

export async function getRosterHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getRoster(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await addStudent(String(req.params.id), req.body.studentId);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function removeStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await removeStudent(String(req.params.id), String(req.params.studentId));
    return sendSuccess(res, { message: "Student removed from batch" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

// --- Trainers ---

export async function getTrainersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getTrainers(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function assignTrainerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await assignTrainer(String(req.params.id), req.body.trainerId);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function removeTrainerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await removeTrainer(String(req.params.id), String(req.params.trainerId));
    return sendSuccess(res, { message: "Trainer removed from batch" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

// --- Sessions ---

export async function listSessionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await listSessions(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function createSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createSession(String(req.params.id), req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getSessionById(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateSession(String(req.params.id), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteSessionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteSession(String(req.params.id));
    return sendSuccess(res, { message: "Session deleted successfully" });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
