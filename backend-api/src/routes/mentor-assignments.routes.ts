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

const createAssignmentSchema = Joi.object({
  mentorId: Joi.string().uuid().required(),
  studentId: Joi.string().uuid().required(),
});

// ── GET / — List mentor assignments (filterable by mentorId, studentId) ──

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId, studentId } = req.query;

    const where: Record<string, string> = {};
    if (typeof mentorId === 'string') where.mentorId = mentorId;
    if (typeof studentId === 'string') where.studentId = studentId;

    const assignments = await prisma.mentorAssignment.findMany({
      where,
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    sendSuccess(res, assignments);
  } catch (err) {
    sendError(res, 'Failed to fetch mentor assignments.', 500);
  }
});

// ── GET /:id — Get single assignment ──

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const assignment = await prisma.mentorAssignment.findUnique({
      where: { id: paramId(req) },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true, email: true } },
      },
    });

    if (!assignment) {
      sendError(res, 'Mentor assignment not found.', 404);
      return;
    }

    sendSuccess(res, assignment);
  } catch (err) {
    sendError(res, 'Failed to fetch mentor assignment.', 500);
  }
});

// ── POST / — Create a mentor-student assignment ──

router.post('/', validate(createAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { mentorId, studentId } = req.body;

    const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      sendError(res, 'Mentor not found.', 404);
      return;
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student) {
      sendError(res, 'Student not found.', 404);
      return;
    }

    const existing = await prisma.mentorAssignment.findUnique({
      where: { mentorId_studentId: { mentorId, studentId } },
    });
    if (existing) {
      sendError(res, 'This mentor-student assignment already exists.', 409);
      return;
    }

    const assignment = await prisma.mentorAssignment.create({
      data: { mentorId, studentId },
    });

    sendSuccess(res, assignment, 201);
  } catch (err) {
    sendError(res, 'Failed to create mentor assignment.', 500);
  }
});

// ── DELETE /:id — Remove a mentor-student assignment ──

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.mentorAssignment.findUnique({ where: { id: paramId(req) } });
    if (!existing) {
      sendError(res, 'Mentor assignment not found.', 404);
      return;
    }

    await prisma.mentorAssignment.delete({ where: { id: paramId(req) } });

    sendSuccess(res, { message: 'Mentor assignment deleted.' });
  } catch (err) {
    sendError(res, 'Failed to delete mentor assignment.', 500);
  }
});

export default router;
