import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';
import {
  ServiceError,
  createEvent,
  updateEvent,
  closeEvent,
  reopenEvent,
  deleteEvent,
  addRound,
  updateRound,
  deleteRound,
  listEvents,
  getEventById,
  getStudentEvents,
  setStudentRegistrationStatus,
  getEventRegistrations,
} from '../services/events.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ServiceError) {
    return sendError(res, err.message, err.statusCode);
  }
  next(err);
}

function deriveScope(req: Request, action: 'create' | 'read' | 'update' | 'delete'): string {
  const held: Set<string> = (req as any).heldPermissions || new Set();
  if (held.has(`events:${action}:any`)) return 'any';
  if (held.has(`events:${action}:batch`)) return 'batch';
  return 'own';
}

function deriveReadScope(req: Request): string {
  const held: Set<string> = (req as any).heldPermissions || new Set();
  if (held.has('events:read:any')) return 'any';
  if (held.has('events:read:batch')) return 'batch';
  return 'own';
}

export async function createEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'create');
    const result = await createEvent(req.body, req.user!.sub, scope);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await updateEvent(String(req.params.id), req.body, req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function closeEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await closeEvent(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function reopenEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await reopenEvent(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'delete');
    const result = await deleteEvent(String(req.params.id), req.user!.sub, scope);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function addRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await addRound(String(req.params.id), req.body, req.user!.sub, scope);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await updateRound(
      String(req.params.id),
      String(req.params.roundId),
      req.body,
      req.user!.sub,
      scope,
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function deleteRoundHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveScope(req, 'update');
    const result = await deleteRound(
      String(req.params.id),
      String(req.params.roundId),
      req.user!.sub,
      scope,
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveReadScope(req);
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const filters = {
      batchId: req.query.batchId ? String(req.query.batchId) : undefined,
      category: req.query.category ? String(req.query.category) : undefined,
      isMandatory: req.query.isMandatory !== undefined ? String(req.query.isMandatory) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    };

    const { events, total } = await listEvents(filters, req.user!.sub, scope, page, limit);
    return sendPaginated(res, events, total, page, limit);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveReadScope(req);
    const statusFilter = req.query.registrationStatus ? String(req.query.registrationStatus) : undefined;
    const result = await getEventById(String(req.params.id), req.user!.sub, scope, statusFilter);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function studentEventsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      category: req.query.category ? String(req.query.category).toUpperCase() : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
    };
    const result = await getStudentEvents(req.user!.sub, filters);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function setStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await setStudentRegistrationStatus(
      String(req.params.id),
      req.user!.sub,
      req.body.status,
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getRegistrationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = deriveReadScope(req);
    const statusFilter = req.query.status ? String(req.query.status) : undefined;
    const result = await getEventRegistrations(
      String(req.params.id),
      req.user!.sub,
      scope,
      statusFilter,
    );
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
