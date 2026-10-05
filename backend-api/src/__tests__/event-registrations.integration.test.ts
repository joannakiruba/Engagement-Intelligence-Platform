import express from 'express';
import request from 'supertest';

const STUDENT_ID = 's0000000-0000-0000-0000-000000000001';
const EVENT_ID = 'e0000000-0000-0000-0000-000000000002';
const REG_ID = 'r0000000-0000-0000-0000-000000000003';

const fns = {
  eventFindUnique: jest.fn(),
  regFindUnique: jest.fn(),
  regFindMany: jest.fn(),
  regCreate: jest.fn(),
  regDelete: jest.fn(),
};

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...a: any[]) => fns.eventFindUnique(...a),
    },
    eventRegistration: {
      findUnique: (...a: any[]) => fns.regFindUnique(...a),
      findMany: (...a: any[]) => fns.regFindMany(...a),
      create: (...a: any[]) => fns.regCreate(...a),
      delete: (...a: any[]) => fns.regDelete(...a),
    },
  },
}));

import eventRegRoutes from '../routes/event-registrations.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: STUDENT_ID, roleId: 'student-role-id' };
    next();
  });
  app.use('/api/event-registrations', eventRegRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(fns).forEach((fn) => fn.mockReset());
});

const SAMPLE_EVENT = {
  id: EVENT_ID,
  title: 'HackForGood 2026',
  eventType: 'HACKATHON',
  eventDate: new Date('2026-10-15').toISOString(),
  registrationDeadline: new Date('2026-10-13').toISOString(),
};

const SAMPLE_REG = {
  id: REG_ID,
  eventId: EVENT_ID,
  studentId: STUDENT_ID,
  registeredAt: new Date().toISOString(),
  event: { id: EVENT_ID, title: 'HackForGood 2026', eventType: 'HACKATHON', eventDate: new Date('2026-10-15').toISOString() },
};

describe('POST /api/event-registrations', () => {
  it('registers student for an event', async () => {
    fns.eventFindUnique.mockResolvedValue({ ...SAMPLE_EVENT, registrationDeadline: new Date('2099-12-31') });
    fns.regFindUnique.mockResolvedValue(null);
    fns.regCreate.mockResolvedValue(SAMPLE_REG);

    const res = await request(app).post('/api/event-registrations').send({ eventId: EVENT_ID });

    expect(res.status).toBe(201);
    expect(res.body.data.eventId).toBe(EVENT_ID);
  });

  it('returns 404 when event not found', async () => {
    fns.eventFindUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/event-registrations').send({ eventId: 'nonexistent' });

    expect(res.status).toBe(404);
  });

  it('returns 409 when already registered', async () => {
    fns.eventFindUnique.mockResolvedValue({ ...SAMPLE_EVENT, registrationDeadline: new Date('2099-12-31') });
    fns.regFindUnique.mockResolvedValue(SAMPLE_REG);

    const res = await request(app).post('/api/event-registrations').send({ eventId: EVENT_ID });

    expect(res.status).toBe(409);
  });

  it('returns 400 when registration deadline passed', async () => {
    fns.eventFindUnique.mockResolvedValue({ ...SAMPLE_EVENT, registrationDeadline: new Date('2020-01-01') });

    const res = await request(app).post('/api/event-registrations').send({ eventId: EVENT_ID });

    expect(res.status).toBe(400);
  });

  it('returns 400 when eventId missing', async () => {
    const res = await request(app).post('/api/event-registrations').send({});

    expect(res.status).toBe(400);
  });
});

describe('GET /api/event-registrations/my', () => {
  it('returns own registrations', async () => {
    fns.regFindMany.mockResolvedValue([SAMPLE_REG]);

    const res = await request(app).get('/api/event-registrations/my');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/event-registrations', () => {
  it('lists all registrations', async () => {
    fns.regFindMany.mockResolvedValue([SAMPLE_REG]);

    const res = await request(app).get('/api/event-registrations');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('DELETE /api/event-registrations/:id', () => {
  it('cancels own registration', async () => {
    fns.regFindUnique.mockResolvedValue(SAMPLE_REG);
    fns.regDelete.mockResolvedValue(SAMPLE_REG);

    const res = await request(app).delete(`/api/event-registrations/${REG_ID}`);

    expect(res.status).toBe(200);
  });

  it('returns 404 when not found', async () => {
    fns.regFindUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/event-registrations/nonexistent');

    expect(res.status).toBe(404);
  });

  it('returns 403 when cancelling another student registration', async () => {
    fns.regFindUnique.mockResolvedValue({ ...SAMPLE_REG, studentId: 'other-student' });

    const res = await request(app).delete(`/api/event-registrations/${REG_ID}`);

    expect(res.status).toBe(403);
  });
});
