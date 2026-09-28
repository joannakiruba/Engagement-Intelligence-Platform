import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  getDashboard,
  getBatchEngagement,
  getStudentEngagement,
  getBatchTrends,
} from '../services/engagement.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function dashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { from?: string; to?: string } = {};
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    const result = await getDashboard(filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function batchEngagementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { from?: string; to?: string } = {};
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    const result = await getBatchEngagement(String(req.params.batchId), filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function studentEngagementHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { batchId?: string; from?: string; to?: string } = {};
    if (req.query.batchId) filters.batchId = String(req.query.batchId);
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    const result = await getStudentEngagement(String(req.params.studentId), filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function batchTrendsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { from?: string; to?: string } = {};
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);
    const result = await getBatchTrends(String(req.params.batchId), filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
