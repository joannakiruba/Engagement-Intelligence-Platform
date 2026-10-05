import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';

const router = Router();

const createSchema = Joi.object({
  studentId: Joi.string().uuid().required(),
  riskScoreId: Joi.string().uuid().optional(),
  title: Joi.string().max(200).required(),
  description: Joi.string().max(2000).required(),
  deadline: Joi.date().iso().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  description: Joi.string().max(2000).optional(),
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
  deadline: Joi.date().iso().allow(null).optional(),
});

const outcomeSchema = Joi.object({
  outcome: Joi.string().valid('IMPROVED', 'NO_CHANGE', 'DECLINED').required(),
  remarks: Joi.string().max(2000).optional(),
});

const updateNoteSchema = Joi.object({
  note: Joi.string().max(2000).required(),
});

const INTERVENTION_INCLUDE = {
  student: { select: { id: true, name: true, email: true } },
  mentor: { select: { id: true, name: true, email: true } },
  riskScore: { select: { id: true, totalScore: true, riskLevel: true } },
  updates: { orderBy: { createdAt: 'desc' as const } },
  outcome: true,
};

// POST / — Create intervention (mentor for assigned students)
router.post(
  '/',
  requirePermission('interventions:create:assigned'),
  validate(createSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentorId = req.user!.sub;
      const { studentId, riskScoreId, title, description, deadline } = req.body;

      const assignment = await prisma.mentorAssignment.findUnique({
        where: { mentorId_studentId: { mentorId, studentId } },
      });
      if (!assignment) {
        return sendError(res, 'You can only create interventions for your assigned students', 403);
      }

      const intervention = await prisma.intervention.create({
        data: {
          studentId,
          mentorId,
          riskScoreId: riskScoreId || null,
          title,
          description,
          deadline: deadline ? new Date(deadline) : null,
        },
        include: INTERVENTION_INCLUDE,
      });

      return sendSuccess(res, intervention, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — List interventions (scoped by permission)
router.get(
  '/',
  requirePermission('interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();

      const where: Record<string, unknown> = {};

      if (heldPermissions.has('interventions:read:any')) {
        // no filter
      } else if (heldPermissions.has('interventions:read:assigned')) {
        where.mentorId = userId;
      } else {
        where.studentId = userId;
      }

      if (req.query.studentId) where.studentId = String(req.query.studentId);
      if (req.query.status) where.status = String(req.query.status);

      const interventions = await prisma.intervention.findMany({
        where,
        include: INTERVENTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(res, interventions);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — Get single intervention
router.get(
  '/:id',
  requirePermission('interventions:read:own', 'interventions:read:assigned', 'interventions:read:any'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const intervention = await prisma.intervention.findUnique({
        where: { id: String(req.params.id) },
        include: INTERVENTION_INCLUDE,
      });
      if (!intervention) return sendError(res, 'Intervention not found', 404);
      return sendSuccess(res, intervention);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id — Update intervention (mentor who created it)
router.put(
  '/:id',
  requirePermission('interventions:update:own'),
  validate(updateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentorId = req.user!.sub;
      const existing = await prisma.intervention.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!existing) return sendError(res, 'Intervention not found', 404);
      if (existing.mentorId !== mentorId) {
        return sendError(res, 'You can only update interventions you created', 403);
      }

      const data: Record<string, unknown> = {};
      if (req.body.title !== undefined) data.title = req.body.title;
      if (req.body.description !== undefined) data.description = req.body.description;
      if (req.body.status !== undefined) data.status = req.body.status;
      if (req.body.deadline !== undefined) data.deadline = req.body.deadline ? new Date(req.body.deadline) : null;

      const updated = await prisma.intervention.update({
        where: { id: existing.id },
        data,
        include: INTERVENTION_INCLUDE,
      });

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/updates — Add progress note
router.post(
  '/:id/updates',
  requirePermission('interventions:update:own'),
  validate(updateNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentorId = req.user!.sub;
      const intervention = await prisma.intervention.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!intervention) return sendError(res, 'Intervention not found', 404);
      if (intervention.mentorId !== mentorId) {
        return sendError(res, 'You can only add notes to interventions you created', 403);
      }

      const update = await prisma.interventionUpdate.create({
        data: {
          interventionId: intervention.id,
          note: req.body.note,
        },
      });

      return sendSuccess(res, update, 201);
    } catch (err) {
      next(err);
    }
  },
);

// POST /:id/outcome — Log outcome
router.post(
  '/:id/outcome',
  requirePermission('interventions:log_outcome:own'),
  validate(outcomeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentorId = req.user!.sub;
      const intervention = await prisma.intervention.findUnique({
        where: { id: String(req.params.id) },
        include: { outcome: true },
      });
      if (!intervention) return sendError(res, 'Intervention not found', 404);
      if (intervention.mentorId !== mentorId) {
        return sendError(res, 'You can only log outcomes for interventions you created', 403);
      }
      if (intervention.outcome) {
        return sendError(res, 'Outcome already recorded for this intervention', 409);
      }

      const outcome = await prisma.interventionOutcome.create({
        data: {
          interventionId: intervention.id,
          outcome: req.body.outcome,
          remarks: req.body.remarks || null,
        },
      });

      await prisma.intervention.update({
        where: { id: intervention.id },
        data: { status: 'COMPLETED' },
      });

      return sendSuccess(res, outcome, 201);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
