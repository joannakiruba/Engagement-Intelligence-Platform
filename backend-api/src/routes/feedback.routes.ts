import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate.middleware';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

function paramId(req: Request, key = 'id'): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : val;
}

// ── Validation schemas ──

const createFeedbackSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  studentId: Joi.string().uuid().required(),
  trainerId: Joi.string().uuid().required(),
  effortRating: Joi.number().integer().min(1).max(5).required(),
  participationRating: Joi.number().integer().min(1).max(5).required(),
  comments: Joi.string().max(2000).allow('', null).optional(),
});

const updateFeedbackSchema = Joi.object({
  effortRating: Joi.number().integer().min(1).max(5).optional(),
  participationRating: Joi.number().integer().min(1).max(5).optional(),
  comments: Joi.string().max(2000).allow('', null).optional(),
}).min(1);

// ── GET / — List feedback (filterable by sessionId, studentId, trainerId) ──

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, trainerId } = req.query;

    const where: Record<string, string> = {};
    if (typeof sessionId === 'string') where.sessionId = sessionId;
    if (typeof studentId === 'string') where.studentId = studentId;
    if (typeof trainerId === 'string') where.trainerId = trainerId;

    const records = await prisma.feedback.findMany({
      where,
      include: {
        session: { select: { id: true, title: true, scheduledDate: true } },
        student: { select: { id: true, name: true, email: true } },
        trainer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, records);
  } catch (err) {
    sendError(res, 'Failed to fetch feedback records.', 500);
  }
});

// ── GET /:id — Get single feedback record ──

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await prisma.feedback.findUnique({
      where: { id: paramId(req) },
      include: {
        session: { select: { id: true, title: true, scheduledDate: true, batchId: true } },
        student: { select: { id: true, name: true, email: true } },
        trainer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!record) {
      sendError(res, 'Feedback record not found.', 404);
      return;
    }

    sendSuccess(res, record);
  } catch (err) {
    sendError(res, 'Failed to fetch feedback record.', 500);
  }
});

// ── POST / — Create feedback for a student in a session ──

router.post('/', validate(createFeedbackSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, trainerId, effortRating, participationRating, comments } = req.body;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      sendError(res, 'Session not found.', 404);
      return;
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      sendError(res, 'Student not found.', 404);
      return;
    }

    const trainer = await prisma.user.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      sendError(res, 'Trainer not found.', 404);
      return;
    }

    const record = await prisma.feedback.create({
      data: { sessionId, studentId, trainerId, effortRating, participationRating, comments },
    });

    sendSuccess(res, record, 201);
  } catch (err) {
    sendError(res, 'Failed to create feedback.', 500);
  }
});

// ── PUT /:id — Update a feedback record ──

router.put('/:id', validate(updateFeedbackSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.feedback.findUnique({ where: { id: paramId(req) } });
    if (!existing) {
      sendError(res, 'Feedback record not found.', 404);
      return;
    }

    const updated = await prisma.feedback.update({
      where: { id: paramId(req) },
      data: req.body,
    });

    sendSuccess(res, updated);
  } catch (err) {
    sendError(res, 'Failed to update feedback.', 500);
  }
});

// ── DELETE /:id — Delete a feedback record ──

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.feedback.findUnique({ where: { id: paramId(req) } });
    if (!existing) {
      sendError(res, 'Feedback record not found.', 404);
      return;
    }

    await prisma.feedback.delete({ where: { id: paramId(req) } });

    sendSuccess(res, { message: 'Feedback record deleted.' });
  } catch (err) {
    sendError(res, 'Failed to delete feedback.', 500);
  }
});

export default router;
