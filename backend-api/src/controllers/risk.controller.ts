import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import {
  ServiceError,
  calculateStudentRisk,
  calculateBatchRisk,
  getLatestRiskScore,
  getRiskHistory,
  getHighRiskStudents,
} from '../services/risk/risk-score.service';
import { ResolvedScope, enforceScopeForUser, getScopedBatchIds } from '../auth/rbac.middleware';

function handleServiceError(err: unknown, res: Response, next: NextFunction) {
  if (
    err instanceof ServiceError ||
    (err instanceof Error && typeof (err as any).statusCode === 'number')
  ) {
    return sendError(res, (err as any).message, (err as any).statusCode);
  }
  next(err);
}

function stripFactorsForCategory(riskScore: any): any {
  if (!riskScore) return riskScore;
  const { factors, attendanceRisk, assessmentRisk, feedbackRisk, totalScore, ...rest } = riskScore;
  return rest;
}

export async function calculateStudentRiskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = String(req.params.studentId);
    const batchId = String(req.body.batchId);

    const scope: ResolvedScope = (req as any).resolvedScope || 'none';
    if (scope === 'batch') {
      const scopedBatchIds = await getScopedBatchIds(req);
      if (scopedBatchIds !== 'all' && !scopedBatchIds.includes(batchId)) {
        return sendError(res, 'Insufficient permissions.', 403);
      }
    }

    const riskScore = await calculateStudentRisk(studentId, batchId);
    return sendSuccess(res, riskScore, 201);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function calculateBatchRiskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const batchId = String(req.params.batchId);

    const scope: ResolvedScope = (req as any).resolvedScope || 'none';
    if (scope === 'batch') {
      const scopedBatchIds = await getScopedBatchIds(req);
      if (scopedBatchIds !== 'all' && !scopedBatchIds.includes(batchId)) {
        return sendError(res, 'Insufficient permissions.', 403);
      }
    }

    const result = await calculateBatchRisk(batchId);
    return sendSuccess(res, result);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getStudentRiskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = String(req.params.studentId);
    const scope: ResolvedScope = (req as any).resolvedScope || 'none';

    if (scope === 'own' || scope === 'self') {
      if (studentId !== req.user!.sub) {
        return sendError(res, 'Insufficient permissions.', 403);
      }
    } else if (scope === 'category_batch') {
      const allowed = await enforceScopeForUser(req, studentId);
      if (!allowed) return sendError(res, 'Insufficient permissions.', 403);
    } else if (scope === 'assigned') {
      const allowed = await enforceScopeForUser(req, studentId);
      if (!allowed) return sendError(res, 'Insufficient permissions.', 403);
    } else if (scope === 'none') {
      return sendError(res, 'Insufficient permissions.', 403);
    }

    const riskScore = await getLatestRiskScore(studentId);
    if (!riskScore) {
      return sendError(res, 'No risk score found for this student', 404);
    }

    if (scope === 'category_batch') {
      return sendSuccess(res, stripFactorsForCategory(riskScore));
    }

    return sendSuccess(res, riskScore);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getStudentRiskHistoryHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = String(req.params.studentId);
    const scope: ResolvedScope = (req as any).resolvedScope || 'none';

    if (scope === 'own' || scope === 'self') {
      if (studentId !== req.user!.sub) {
        return sendError(res, 'Insufficient permissions.', 403);
      }
    } else if (scope === 'assigned') {
      const allowed = await enforceScopeForUser(req, studentId);
      if (!allowed) return sendError(res, 'Insufficient permissions.', 403);
    } else if (scope === 'none' || scope === 'category_batch') {
      return sendError(res, 'Insufficient permissions.', 403);
    }

    const history = await getRiskHistory(studentId);
    return sendSuccess(res, history);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}

export async function getHighRiskHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const scores = await getHighRiskStudents();
    return sendSuccess(res, scores);
  } catch (err) {
    return handleServiceError(err, res, next);
  }
}
