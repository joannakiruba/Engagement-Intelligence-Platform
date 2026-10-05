import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';

const router = Router();

// POST / — Register self for an event (student)
router.post(
  '/',
  requirePermission('event_registrations:create:self'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user!.sub;
      const { eventId } = req.body;

      if (!eventId) return sendError(res, 'eventId is required', 400);

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) return sendError(res, 'Event not found', 404);

      if (event.registrationDeadline && new Date() > event.registrationDeadline) {
        return sendError(res, 'Registration deadline has passed', 400);
      }

      const existing = await prisma.eventRegistration.findUnique({
        where: { eventId_studentId: { eventId, studentId } },
      });
      if (existing) return sendError(res, 'Already registered for this event', 409);

      const registration = await prisma.eventRegistration.create({
        data: { eventId, studentId },
        include: {
          event: { select: { id: true, title: true, eventType: true, eventDate: true } },
        },
      });

      return sendSuccess(res, registration, 201);
    } catch (err) {
      next(err);
    }
  },
);

// GET /my — Get own registrations (student)
router.get(
  '/my',
  requirePermission('event_registrations:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const registrations = await prisma.eventRegistration.findMany({
        where: { studentId: req.user!.sub },
        include: {
          event: { select: { id: true, title: true, eventType: true, eventDate: true } },
        },
        orderBy: { registeredAt: 'desc' },
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
  requirePermission('event_registrations:read:any'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.eventId) where.eventId = String(req.query.eventId);
      if (req.query.studentId) where.studentId = String(req.query.studentId);

      const registrations = await prisma.eventRegistration.findMany({
        where,
        include: {
          event: { select: { id: true, title: true, eventType: true, eventDate: true } },
          student: { select: { id: true, name: true, email: true } },
        },
        orderBy: { registeredAt: 'desc' },
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
  requirePermission('event_registrations:create:self'),
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

      await prisma.eventRegistration.delete({ where: { id: registration.id } });
      return sendSuccess(res, { message: 'Registration cancelled' });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
