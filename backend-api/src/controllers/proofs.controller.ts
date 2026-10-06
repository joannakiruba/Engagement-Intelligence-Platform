import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  submitProof,
  replaceProofFile,
  getMyProofs,
  listProofs,
  getProofById,
  reviewProof,
} from '../services/proofs.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function submitProofHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400);
    const result = await submitProof(req.user!.sub, req.body.eventId, req.file);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function replaceProofFileHandler(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return sendError(res, 'No file uploaded', 400);
    const result = await replaceProofFile(req.user!.sub, String(req.params.id), req.file);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getMyProofsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const submissions = await getMyProofs(req.user!.sub);
    return sendSuccess(res, submissions);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listProofsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { eventId?: string; studentId?: string; status?: string } = {};
    if (req.query.eventId) filters.eventId = String(req.query.eventId);
    if (req.query.studentId) filters.studentId = String(req.query.studentId);
    if (req.query.status) filters.status = String(req.query.status);
    const submissions = await listProofs(filters);
    return sendSuccess(res, submissions);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getProofHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const submission = await getProofById(String(req.params.id));
    return sendSuccess(res, submission);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function reviewProofHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await reviewProof(String(req.params.id), req.body.status, req.body.remarks);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
