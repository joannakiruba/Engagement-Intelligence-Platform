import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  generateWeeklyReportData,
  computeWeekBounds,
  validateDateRange,
  scheduleAllWeeklyReports,
  getScheduleConfig,
  ServiceError,
} from '../services/weekly-report.service';
import type { ResolvedScope } from '../auth/rbac.middleware';

export async function previewWeeklyReportHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const scope: ResolvedScope = (req as any).resolvedScope || 'none';

    let mentorId: string;
    const queryMentorId = req.query.mentorId ? String(req.query.mentorId) : undefined;
    if (scope === 'any' && queryMentorId) {
      mentorId = queryMentorId;
    } else if (scope === 'assigned' || scope === 'own' || scope === 'self') {
      mentorId = req.user!.sub;
    } else if (scope === 'any') {
      mentorId = req.user!.sub;
    } else {
      return sendError(res, 'Insufficient permissions.', 403);
    }

    const qWeekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;
    const qWeekEnd = req.query.weekEnd ? String(req.query.weekEnd) : undefined;
    let bounds: { weekStart: Date; weekEnd: Date };
    if (qWeekStart && qWeekEnd) {
      bounds = { weekStart: new Date(qWeekStart), weekEnd: new Date(qWeekEnd) };
      validateDateRange(bounds.weekStart, bounds.weekEnd);
    } else if (qWeekStart || qWeekEnd) {
      return sendError(res, 'Both weekStart and weekEnd are required for custom ranges', 400);
    } else {
      bounds = computeWeekBounds();
    }

    const report = await generateWeeklyReportData(
      mentorId,
      bounds.weekStart,
      bounds.weekEnd,
    );

    return sendSuccess(res, report);
  } catch (err) {
    if (err instanceof ServiceError) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

export async function triggerWeeklyReportsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body || {};
    let bounds: { weekStart: Date; weekEnd: Date };
    if (body.weekStart && body.weekEnd) {
      bounds = { weekStart: new Date(body.weekStart), weekEnd: new Date(body.weekEnd) };
      validateDateRange(bounds.weekStart, bounds.weekEnd);
    } else if (body.weekStart || body.weekEnd) {
      return sendError(res, 'Both weekStart and weekEnd are required for custom ranges', 400);
    } else {
      bounds = computeWeekBounds();
    }

    const result = await scheduleAllWeeklyReports(
      bounds.weekStart,
      bounds.weekEnd,
    );

    return sendSuccess(res, {
      message: `Queued weekly reports for ${result.queued} mentors`,
      ...result,
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
    }, 202);
  } catch (err) {
    if (err instanceof ServiceError) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

export function getScheduleHandler(
  _req: Request,
  res: Response,
) {
  const schedule = getScheduleConfig();
  return sendSuccess(res, schedule);
}
