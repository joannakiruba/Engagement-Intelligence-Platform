import { Request, Response, NextFunction } from 'express';
import { sendPaginated, sendError } from '../utils/response';
import {
  ServiceError,
  getTrainingHistory,
  TrainingHistoryFilters,
} from '../services/training-history.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function getMyTrainingHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const studentId = req.user!.sub;

    // Parse pagination params
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;

    // Parse date filters
    const filters: TrainingHistoryFilters = {};
    if (req.query.from) filters.from = String(req.query.from);
    if (req.query.to) filters.to = String(req.query.to);

    // Validate pagination
    if (isNaN(page) || page < 1) {
      return sendError(res, 'Invalid page number', 400);
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return sendError(res, 'Invalid limit (must be between 1 and 100)', 400);
    }

    // Validate date filters
    if (filters.from && isNaN(Date.parse(filters.from))) {
      return sendError(res, 'Invalid from date', 400);
    }

    if (filters.to && isNaN(Date.parse(filters.to))) {
      return sendError(res, 'Invalid to date', 400);
    }

    if (
      filters.from &&
      filters.to &&
      new Date(filters.from) > new Date(filters.to)
    ) {
      return sendError(res, 'from date must be before to date', 400);
    }

    const result = await getTrainingHistory(studentId, filters, page, limit);

    return sendPaginated(res, result.items, result.total, page, limit);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
