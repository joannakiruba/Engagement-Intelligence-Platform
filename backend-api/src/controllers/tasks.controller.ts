import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError, sendPaginated } from '../utils/response';
import {
  ServiceError,
  createTask,
  updateTask,
  listTasks,
  getTaskById,
  changeDeadline,
  closeTask,
  reopenTask,
  deleteTask,
  getStudentTasks,
  updateStudentProgress,
  toggleInterested,
  addStudentToTask,
  setMarks,
  bulkSetMarks,
  exportMarks,
} from '../services/tasks.service';
import { DeadlineType, TaskProgress } from '@prisma/client';

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

export async function listTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:read:any') ? 'any' : 'batch';

    const filters: Record<string, unknown> = {};
    if (req.query.batchId) filters.batchId = String(req.query.batchId);
    if (req.query.isMandatory !== undefined) filters.isMandatory = req.query.isMandatory === 'true';
    if (req.query.isInternal !== undefined) filters.isInternal = req.query.isInternal === 'true';
    if (req.query.deadlineType) {
      const dt = String(req.query.deadlineType).toUpperCase();
      if (['FIXED', 'TENTATIVE', 'TBD', 'NONE'].includes(dt)) {
        filters.deadlineType = dt as DeadlineType;
      }
    }
    if (req.query.status) {
      const s = String(req.query.status).toLowerCase();
      if (s === 'open' || s === 'closed') filters.status = s;
    }
    if (req.query.search) filters.search = String(req.query.search);
    if (req.query.page) filters.page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    if (req.query.limit) filters.limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));

    const result = await listTasks(filters as any, req.user!.sub, scope);
    return sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    let scope: string;
    if (heldPermissions.has('tasks:read:any')) scope = 'any';
    else if (heldPermissions.has('tasks:read:batch')) scope = 'batch';
    else scope = 'own';

    let progressFilter: TaskProgress | undefined;
    if (req.query.progress) {
      const p = String(req.query.progress).toUpperCase();
      if (['NOT_STARTED', 'IN_PROGRESS', 'ALMOST_COMPLETED', 'COMPLETED'].includes(p)) {
        progressFilter = p as TaskProgress;
      }
    }

    const result = await getTaskById(String(req.params.id), req.user!.sub, scope, progressFilter);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function changeDeadlineHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:update:any') ? 'any' : 'batch';
    const result = await changeDeadline(String(req.params.id), req.body, req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function closeTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:update:any') ? 'any' : 'batch';
    const result = await closeTask(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function reopenTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:update:any') ? 'any' : 'batch';
    const result = await reopenTask(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteTaskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:delete:any') ? 'any' : 'batch';
    await deleteTask(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, { message: 'Task deleted successfully' });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function studentTasksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: Record<string, unknown> = {};
    if (req.query.batchId) filters.batchId = String(req.query.batchId);
    if (req.query.progress) {
      const p = String(req.query.progress).toUpperCase();
      if (['NOT_STARTED', 'IN_PROGRESS', 'ALMOST_COMPLETED', 'COMPLETED'].includes(p)) {
        filters.progress = p as TaskProgress;
      }
    }
    if (req.query.isMandatory !== undefined) filters.isMandatory = req.query.isMandatory === 'true';
    if (req.query.status) {
      const s = String(req.query.status).toLowerCase();
      if (s === 'open' || s === 'closed') filters.status = s;
    }

    const result = await getStudentTasks(req.user!.sub, filters as any);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateProgressHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateStudentProgress(
      String(req.params.id),
      req.user!.sub,
      req.body.progress,
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function toggleInterestedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await toggleInterested(String(req.params.id), req.user!.sub);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addStudentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:update:any') ? 'any' : 'batch';
    const result = await addStudentToTask(
      String(req.params.id),
      req.body.studentId,
      req.user!.sub,
      scope,
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function setMarksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:grade:any') ? 'any' : 'batch';
    const result = await setMarks(String(req.params.id), req.body, req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function bulkSetMarksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:grade:any') ? 'any' : 'batch';
    const result = await bulkSetMarks(String(req.params.id), req.body.entries, req.user!.sub, scope);
    const statusCode = result.errors > 0 ? 207 : 200;
    return sendSuccess(res, result, statusCode);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function exportMarksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();
    const scope = heldPermissions.has('tasks:grade:any') ? 'any' : 'batch';
    const result = await exportMarks(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
