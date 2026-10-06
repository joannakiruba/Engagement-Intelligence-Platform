import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  createIntervention,
  listInterventions,
  getInterventionById,
  updateIntervention,
  addProgressNote,
  logOutcome,
} from '../services/interventions.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function createInterventionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createIntervention(req.user!.sub, req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listInterventionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const filters: { studentId?: string; status?: string } = {};
    if (req.query.studentId) filters.studentId = String(req.query.studentId);
    if (req.query.status) filters.status = String(req.query.status);
    const interventions = await listInterventions(req.user!.sub, heldPermissions, filters);
    return sendSuccess(res, interventions);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getInterventionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const intervention = await getInterventionById(String(req.params.id));
    return sendSuccess(res, intervention);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateInterventionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateIntervention(req.user!.sub, String(req.params.id), req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addProgressNoteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await addProgressNote(req.user!.sub, String(req.params.id), req.body.note);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function logOutcomeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await logOutcome(req.user!.sub, String(req.params.id), req.body.outcome, req.body.remarks);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
