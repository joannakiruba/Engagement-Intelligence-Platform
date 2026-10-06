import express from 'express';
import request from 'supertest';

const USER_ID = 'u0000000-0000-0000-0000-000000000001';

const fns = {
  notifFindMany: jest.fn(),
  notifCount: jest.fn(),
  notifFindUnique: jest.fn(),
  notifUpdate: jest.fn(),
  notifUpdateMany: jest.fn(),
};

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    notification: {
      findMany: (...a: any[]) => fns.notifFindMany(...a),
      count: (...a: any[]) => fns.notifCount(...a),
      findUnique: (...a: any[]) => fns.notifFindUnique(...a),
      update: (...a: any[]) => fns.notifUpdate(...a),
      updateMany: (...a: any[]) => fns.notifUpdateMany(...a),
    },
  },
}));

import notificationRoutes from '../routes/notifications.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: USER_ID, roleId: 'student-role-id' };
    next();
  });
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(fns).forEach((fn) => fn.mockReset());
});

const SAMPLE_NOTIF = {
  id: 'n1',
  userId: USER_ID,
  title: 'Risk Alert',
  message: 'Your risk score increased',
  type: 'RISK_ALERT',
  isRead: false,
  createdAt: new Date().toISOString(),
};

describe('GET /api/notifications', () => {
  it('returns paginated notifications with unread count', async () => {
    fns.notifFindMany.mockResolvedValue([SAMPLE_NOTIF]);
    fns.notifCount
      .mockResolvedValueOnce(1)  // total
      .mockResolvedValueOnce(1); // unread

    const res = await request(app).get('/api/notifications');

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.unreadCount).toBe(1);
  });

  it('supports pagination params', async () => {
    fns.notifFindMany.mockResolvedValue([]);
    fns.notifCount.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const res = await request(app).get('/api/notifications?limit=10&offset=10');

    expect(res.status).toBe(200);
    expect(res.body.data.notifications).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks notification as read', async () => {
    fns.notifFindUnique.mockResolvedValue(SAMPLE_NOTIF);
    fns.notifUpdate.mockResolvedValue({ ...SAMPLE_NOTIF, isRead: true });

    const res = await request(app).patch('/api/notifications/n1/read');

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  it('returns 404 when not found', async () => {
    fns.notifFindUnique.mockResolvedValue(null);

    const res = await request(app).patch('/api/notifications/nonexistent/read');

    expect(res.status).toBe(404);
  });

  it('returns 404 when not own notification', async () => {
    fns.notifFindUnique.mockResolvedValue({ ...SAMPLE_NOTIF, userId: 'other-user' });

    const res = await request(app).patch('/api/notifications/n1/read');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/notifications/mark-all-read', () => {
  it('marks all unread notifications as read', async () => {
    fns.notifUpdateMany.mockResolvedValue({ count: 5 });

    const res = await request(app).patch('/api/notifications/mark-all-read');

    expect(res.status).toBe(200);
    expect(res.body.data.success).toBe(true);
  });
});
