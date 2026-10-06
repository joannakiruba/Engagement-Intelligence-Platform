import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate.middleware';
import { requirePermission } from '../auth/rbac.middleware';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../lib/prisma';

const router = Router();

const listSchema = Joi.object({
  unreadOnly: Joi.string().valid('true', 'false').optional(),
  type: Joi.string().valid('RISK_ALERT', 'EVENT_REMINDER', 'INTERVENTION', 'GENERAL', 'TASK_UPDATE').optional(),
  limit: Joi.number().integer().min(1).max(100).default(30),
  offset: Joi.number().integer().min(0).default(0),
});

router.get(
  '/',
  requirePermission('notifications:read:own'),
  validate(listSchema, 'query'),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub;
    const { unreadOnly, type, limit, offset } = req.query as any;

    const where: any = { userId };
    if (unreadOnly === 'true') where.isRead = false;
    if (type) where.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit) || 30,
        skip: parseInt(offset) || 0,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    sendSuccess(res, { notifications, total, unreadCount });
  },
);

router.get(
  '/unread-count',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response): Promise<void> => {
    const count = await prisma.notification.count({
      where: { userId: req.user!.sub, isRead: false },
    });
    sendSuccess(res, { count });
  },
);

router.patch(
  '/:id/read',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response): Promise<void> => {
    const nId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notification = await prisma.notification.findUnique({ where: { id: nId } });
    if (!notification || notification.userId !== req.user!.sub) {
      sendError(res, 'Notification not found.', 404);
      return;
    }
    const updated = await prisma.notification.update({
      where: { id: nId },
      data: { isRead: true },
    });
    sendSuccess(res, updated);
  },
);

router.patch(
  '/mark-all-read',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response): Promise<void> => {
    await prisma.notification.updateMany({
      where: { userId: req.user!.sub, isRead: false },
      data: { isRead: true },
    });
    sendSuccess(res, { success: true });
  },
);

export default router;
