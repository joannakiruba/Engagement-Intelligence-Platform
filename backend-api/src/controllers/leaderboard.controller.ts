import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { ServiceError, getWeeklyLeaderboard } from '../services/leaderboard.service';
import { leaderboardQuerySchema } from '../validators/leaderboard.validator';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

export async function getLeaderboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { error, value } = leaderboardQuerySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const messages = error.details.map((d) => d.message).join('; ');
      return sendError(res, messages, 400);
    }

    const batchId = String(req.params.batchId);
    const week = value.week ? String(value.week) : undefined;
    const result = await getWeeklyLeaderboard(batchId, week);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
