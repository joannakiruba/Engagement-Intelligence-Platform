import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';

const router = Router();

// GET / — Get own notifications (paginated)
router.get(
  '/',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const page = Math.max(1, parseInt(String(req.query.page)) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where: { userId } }),
      ]);

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      return sendSuccess(res, { notifications, total, unreadCount, page, limit });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/read — Mark a notification as read
router.patch(
  '/:id/read',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;
      const notification = await prisma.notification.findUnique({
        where: { id: String(req.params.id) },
      });

      if (!notification) return sendError(res, 'Notification not found', 404);
      if (notification.userId !== userId) return sendError(res, 'Forbidden', 403);

      const updated = await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true },
      });

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// POST /mark-all-read — Mark all notifications as read
router.post(
  '/mark-all-read',
  requirePermission('notifications:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.sub;

      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return sendSuccess(res, { markedRead: result.count });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
