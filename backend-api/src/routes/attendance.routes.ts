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

const markAttendanceSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  studentId: Joi.string().uuid().required(),
  status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required(),
  checkInTime: Joi.date().iso().optional(),
  remarks: Joi.string().max(500).optional(),
});

const updateAttendanceSchema = Joi.object({
  status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').optional(),
  checkInTime: Joi.date().iso().optional(),
  remarks: Joi.string().max(500).allow('', null).optional(),
}).min(1);

const bulkMarkSchema = Joi.object({
  sessionId: Joi.string().uuid().required(),
  records: Joi.array()
    .items(
      Joi.object({
        studentId: Joi.string().uuid().required(),
        status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').required(),
        checkInTime: Joi.date().iso().optional(),
        remarks: Joi.string().max(500).optional(),
      }),
    )
    .min(1)
    .required(),
});

// ── GET / — List attendance records (filterable by sessionId, studentId) ──

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId } = req.query;

    const where: Record<string, string> = {};
    if (typeof sessionId === 'string') where.sessionId = sessionId;
    if (typeof studentId === 'string') where.studentId = studentId;

    const records = await prisma.attendance.findMany({
      where,
      include: {
        session: { select: { id: true, title: true, scheduledDate: true } },
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, records);
  } catch (err) {
    sendError(res, 'Failed to fetch attendance records.', 500);
  }
});

// ── GET /:id — Get single attendance record ──

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await prisma.attendance.findUnique({
      where: { id: paramId(req) },
      include: {
        session: { select: { id: true, title: true, scheduledDate: true, batchId: true } },
        student: { select: { id: true, name: true, email: true } },
      },
    });

    if (!record) {
      sendError(res, 'Attendance record not found.', 404);
      return;
    }

    sendSuccess(res, record);
  } catch (err) {
    sendError(res, 'Failed to fetch attendance record.', 500);
  }
});

// ── POST / — Mark attendance for a single student ──

router.post('/', validate(markAttendanceSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, studentId, status, checkInTime, remarks } = req.body;

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

    const existing = await prisma.attendance.findUnique({
      where: { sessionId_studentId: { sessionId, studentId } },
    });
    if (existing) {
      sendError(res, 'Attendance already marked for this student in this session.', 409);
      return;
    }

    const record = await prisma.attendance.create({
      data: { sessionId, studentId, status, checkInTime, remarks },
    });

    sendSuccess(res, record, 201);
  } catch (err) {
    sendError(res, 'Failed to mark attendance.', 500);
  }
});

// ── POST /bulk — Mark attendance for multiple students in a session ──

router.post('/bulk', validate(bulkMarkSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId, records } = req.body;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      sendError(res, 'Session not found.', 404);
      return;
    }

    const results: { created: number; skipped: number; errors: string[] } = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const record of records) {
      try {
        const existing = await prisma.attendance.findUnique({
          where: { sessionId_studentId: { sessionId, studentId: record.studentId } },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await prisma.attendance.create({
          data: {
            sessionId,
            studentId: record.studentId,
            status: record.status,
            checkInTime: record.checkInTime,
            remarks: record.remarks,
          },
        });
        results.created++;
      } catch (err) {
        results.errors.push(`Failed for student ${record.studentId}`);
      }
    }

    sendSuccess(res, results, 201);
  } catch (err) {
    sendError(res, 'Failed to bulk mark attendance.', 500);
  }
});

// ── PUT /:id — Update an attendance record ──

router.put('/:id', validate(updateAttendanceSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.attendance.findUnique({ where: { id: paramId(req) } });
    if (!existing) {
      sendError(res, 'Attendance record not found.', 404);
      return;
    }

    const updated = await prisma.attendance.update({
      where: { id: paramId(req) },
      data: req.body,
    });

    sendSuccess(res, updated);
  } catch (err) {
    sendError(res, 'Failed to update attendance record.', 500);
  }
});

// ── DELETE /:id — Delete an attendance record ──

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const existing = await prisma.attendance.findUnique({ where: { id: paramId(req) } });
    if (!existing) {
      sendError(res, 'Attendance record not found.', 404);
      return;
    }

    await prisma.attendance.delete({ where: { id: paramId(req) } });

    sendSuccess(res, { message: 'Attendance record deleted.' });
  } catch (err) {
    sendError(res, 'Failed to delete attendance record.', 500);
  }
});

export default router;
