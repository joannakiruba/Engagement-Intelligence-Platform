import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { ServiceError, createTask, updateTask } from '../services/tasks.service';

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
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:create:any') ? 'any' : 'batch';
    const result = await createTask(req.body, req.user!.sub, scope);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:update:any') ? 'any' : 'batch';
    const result = await updateTask(String(req.params.id), req.body, req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
