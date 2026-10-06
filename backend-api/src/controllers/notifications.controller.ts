import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '../services/notifications.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === 'number')
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

export async function listNotificationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const result = await getNotifications(userId, page, limit);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function markAsReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const result = await markAsRead(userId, String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function markAllAsReadHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const result = await markAllAsRead(userId);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
