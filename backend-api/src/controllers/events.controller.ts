import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  listEvents,
  getEventById,
  createEvent,
  updateEvent,
} from '../services/events.service';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === 'number')
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

export async function listEventsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const events = await listEvents();
    return sendSuccess(res, events);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await getEventById(String(req.params.id));
    return sendSuccess(res, event);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function createEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await createEvent(req.body);
    return sendSuccess(res, event, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function updateEventHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const event = await updateEvent(String(req.params.id), req.body);
    return sendSuccess(res, event);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
