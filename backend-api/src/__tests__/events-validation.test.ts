import express from 'express';
import request from 'supertest';

const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockFindMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      create: (...a: any[]) => mockCreate(...a),
      findUnique: (...a: any[]) => mockFindUnique(...a),
      update: (...a: any[]) => mockUpdate(...a),
      findMany: (...a: any[]) => mockFindMany(...a),
    },
  },
}));

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

import eventRoutes from '../routes/events.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: 'admin-1', roleId: 'admin-role' };
    next();
  });
  app.use('/api/events', eventRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => jest.clearAllMocks());

describe('POST /api/events — Joi validation', () => {
  it('rejects missing title', async () => {
    const res = await request(app).post('/api/events').send({
      eventType: 'Hackathon',
      eventDate: '2026-11-01T09:00:00Z',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing eventType', async () => {
    const res = await request(app).post('/api/events').send({
      title: 'My Event',
      eventDate: '2026-11-01T09:00:00Z',
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing eventDate', async () => {
    const res = await request(app).post('/api/events').send({
      title: 'My Event',
      eventType: 'Hackathon',
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid eventDate format', async () => {
    const res = await request(app).post('/api/events').send({
      title: 'My Event',
      eventType: 'Hackathon',
      eventDate: 'not-a-date',
    });
    expect(res.status).toBe(400);
  });

  it('rejects numeric eventType (was silently accepted before)', async () => {
    const res = await request(app).post('/api/events').send({
      title: 'My Event',
      eventType: 12345,
      eventDate: '2026-11-01T09:00:00Z',
    });
    expect(res.status).toBe(400);
  });

  it('accepts a valid event', async () => {
    mockCreate.mockResolvedValue({ id: 'ev-1', title: 'My Event', eventType: 'Hackathon' });
    const res = await request(app).post('/api/events').send({
      title: 'My Event',
      eventType: 'Hackathon',
      eventDate: '2026-11-01T09:00:00Z',
    });
    expect(res.status).toBe(201);
  });
});

describe('PUT /api/events/:id — Joi validation', () => {
  it('rejects empty body (min 1 field required)', async () => {
    mockFindUnique.mockResolvedValue({ id: 'ev-1' });
    const res = await request(app).put('/api/events/ev-1').send({});
    expect(res.status).toBe(400);
  });

  it('rejects invalid eventDate on update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'ev-1' });
    const res = await request(app).put('/api/events/ev-1').send({
      eventDate: 'garbage',
    });
    expect(res.status).toBe(400);
  });

  it('accepts a valid update', async () => {
    mockFindUnique.mockResolvedValue({ id: 'ev-1' });
    mockUpdate.mockResolvedValue({ id: 'ev-1', title: 'Updated' });
    const res = await request(app).put('/api/events/ev-1').send({
      title: 'Updated',
    });
    expect(res.status).toBe(200);
  });
});
