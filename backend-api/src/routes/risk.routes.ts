import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requirePermission, resolveScope } from '../auth/rbac.middleware';
import {
  calculateStudentSchema,
  studentIdParamSchema,
  batchIdParamSchema,
} from '../validators/risk.validator';
import {
  calculateStudentRiskHandler,
  calculateBatchRiskHandler,
  getStudentRiskHandler,
  getStudentRiskHistoryHandler,
  getHighRiskHandler,
} from '../controllers/risk.controller';

const router = Router();

router.post(
  '/calculate/batch/:batchId',
  validate(batchIdParamSchema, 'params'),
  requirePermission('risk_scores:calculate:batch', 'risk_scores:calculate:any'),
  resolveScope('risk_scores:calculate'),
  calculateBatchRiskHandler,
);

router.post(
  '/calculate/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(calculateStudentSchema),
  requirePermission('risk_scores:calculate:batch', 'risk_scores:calculate:any'),
  resolveScope('risk_scores:calculate'),
  calculateStudentRiskHandler,
);

router.get(
  '/high',
  requirePermission('risk_scores:read:assigned', 'risk_scores:read:any'),
  resolveScope('risk_scores:read'),
  getHighRiskHandler,
);

router.get(
  '/student/:studentId/history',
  validate(studentIdParamSchema, 'params'),
  requirePermission(
    'risk_scores:read:own',
    'risk_scores:read:assigned',
    'risk_scores:read:any',
  ),
  resolveScope('risk_scores:read'),
  getStudentRiskHistoryHandler,
);

router.get(
  '/student/:studentId',
  validate(studentIdParamSchema, 'params'),
  requirePermission(
    'risk_scores:read:own',
    'risk_scores:read:assigned',
    'risk_scores:read:category:batch',
    'risk_scores:read:any',
  ),
  resolveScope('risk_scores:read'),
  getStudentRiskHandler,
);

export default router;
