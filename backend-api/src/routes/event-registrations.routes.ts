import { setStudentRegistrationStatus } from '../services/events.service';
import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';

const router = Router();

// POST / — Register self for an event (student)
router.post(
  '/',
  requirePermission('events:update:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user!.sub;
      const { eventId } = req.body;

      if (!eventId) return sendError(res, 'eventId is required', 400);

      const registration = await setStudentRegistrationStatus(eventId, studentId, 'INTERESTED');

      return sendSuccess(res, registration, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /my — Get own registrations (student)
router.get(
  '/my',
  requirePermission('events:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registrations = await prisma.eventRegistration.findMany({
        where: { studentId: req.user!.sub },
        include: {
          event: { select: { id: true, title: true, category: true, startDate: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return sendSuccess(res, registrations);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — List all registrations with optional filters (admin/coordinator)
router.get(
  '/',
  requirePermission('events:read:any'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.eventId) where.eventId = String(req.query.eventId);
      if (req.query.studentId) where.studentId = String(req.query.studentId);

      const registrations = await prisma.eventRegistration.findMany({
        where,
        include: {
          event: { select: { id: true, title: true, category: true, startDate: true } },
          student: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(res, registrations);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id — Unregister self from an event
router.delete(
  '/:id',
  requirePermission('events:update:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user!.sub;
      const registration = await prisma.eventRegistration.findUnique({
        where: { id: String(req.params.id) },
      });

      if (!registration) return sendError(res, 'Registration not found', 404);
      if (registration.studentId !== studentId) {
        return sendError(res, 'You can only cancel your own registrations', 403);
      }

      await setStudentRegistrationStatus(registration.eventId, studentId, 'WITHDRAWN');
      return sendSuccess(res, { message: 'Registration cancelled' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
