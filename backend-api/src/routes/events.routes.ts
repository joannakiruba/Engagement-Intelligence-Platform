import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        _count: { select: { registrations: true, proofSubmissions: true } },
      },
      orderBy: { eventDate: 'desc' },
    });
    return sendSuccess(res, events);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: String(req.params.id) },
      include: {
        registrations: {
          include: { student: { select: { id: true, name: true, email: true } } },
        },
        proofSubmissions: {
          include: { student: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!event) return sendError(res, 'Event not found', 404);
    return sendSuccess(res, event);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requirePermission('events:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, eventType, eventDate, registrationDeadline } = req.body;

      if (!title || !eventType || !eventDate) {
        return sendError(res, 'title, eventType, and eventDate are required', 400);
      }

      const event = await prisma.event.create({
        data: {
          title,
          description: description || null,
          eventType,
          eventDate: new Date(eventDate),
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline)
            : null,
        },
      });

      return sendSuccess(res, event, 201);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  requirePermission('events:update:any'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.event.findUnique({ where: { id: String(req.params.id) } });
      if (!existing) return sendError(res, 'Event not found', 404);

      const { title, description, eventType, eventDate, registrationDeadline } = req.body;
      const data: Record<string, unknown> = {};
      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description;
      if (eventType !== undefined) data.eventType = eventType;
      if (eventDate !== undefined) data.eventDate = new Date(eventDate);
      if (registrationDeadline !== undefined) {
        data.registrationDeadline = registrationDeadline
          ? new Date(registrationDeadline)
          : null;
      }

      const event = await prisma.event.update({
        where: { id: String(req.params.id) },
        data,
      });

      return sendSuccess(res, event);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
