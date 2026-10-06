import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  listAssignments,
  getAssignmentById,
  createAssignment,
  deleteAssignment,
} from '../services/mentor-assignments.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function listAssignmentsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { mentorId?: string; studentId?: string } = {};
    if (req.query.mentorId) filters.mentorId = String(req.query.mentorId);
    if (req.query.studentId) filters.studentId = String(req.query.studentId);
    const assignments = await listAssignments(filters);
    return sendSuccess(res, assignments);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getAssignmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const assignment = await getAssignmentById(String(req.params.id));
    return sendSuccess(res, assignment);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function createAssignmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createAssignment(req.body.mentorId, req.body.studentId);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteAssignmentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await deleteAssignment(String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
