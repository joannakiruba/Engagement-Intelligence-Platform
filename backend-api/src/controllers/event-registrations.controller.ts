import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  registerForEvent,
  getMyRegistrations,
  listRegistrations,
  cancelRegistration,
} from '../services/event-registrations.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === 'number')
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.sub;
    const { eventId } = req.body;
    const registration = await registerForEvent(studentId, eventId);
    return sendSuccess(res, registration, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getMyRegistrationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const registrations = await getMyRegistrations(req.user!.sub);
    return sendSuccess(res, registrations);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function listRegistrationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: { eventId?: string; studentId?: string } = {};
    if (req.query.eventId) filters.eventId = String(req.query.eventId);
    if (req.query.studentId) filters.studentId = String(req.query.studentId);
    const registrations = await listRegistrations(filters);
    return sendSuccess(res, registrations);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function cancelRegistrationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.user!.sub;
    const result = await cancelRegistration(studentId, String(req.params.id));
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
