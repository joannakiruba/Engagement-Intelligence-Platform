import prisma from '../lib/prisma';

export class ServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export async function getNotifications(userId: string, page: number, limit: number) {
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

  return { notifications, total, unreadCount, page, limit };
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ServiceError(404, 'Notification not found');
  }

  if (notification.userId !== userId) {
    throw new ServiceError(403, 'Forbidden');
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true },
  });

  return updated;
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return { markedRead: result.count };
}
