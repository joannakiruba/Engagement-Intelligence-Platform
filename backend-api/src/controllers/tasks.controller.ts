import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { ServiceError, createTask } from '../services/tasks.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === 'number')
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

export async function createTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope: string = (req as any).resolvedScope || 'none';
    const result = await createTask(req.body, req.user!.sub, scope);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
