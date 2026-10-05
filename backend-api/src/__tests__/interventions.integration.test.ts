import express from 'express';
import request from 'supertest';

const MENTOR_ID = 'a0000000-0000-0000-0000-000000000001';
const STUDENT_ID = 'b0000000-0000-0000-0000-000000000002';
const INTERVENTION_ID = 'c0000000-0000-0000-0000-000000000003';
const RISK_SCORE_ID = 'd0000000-0000-0000-0000-000000000004';

const fns = {
  maFindUnique: jest.fn(),
  intCreate: jest.fn(),
  intFindMany: jest.fn(),
  intFindUnique: jest.fn(),
  intUpdate: jest.fn(),
  iuCreate: jest.fn(),
  ioCreate: jest.fn(),
};

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    mentorAssignment: {
      findUnique: (...a: any[]) => fns.maFindUnique(...a),
    },
    intervention: {
      create: (...a: any[]) => fns.intCreate(...a),
      findMany: (...a: any[]) => fns.intFindMany(...a),
      findUnique: (...a: any[]) => fns.intFindUnique(...a),
      update: (...a: any[]) => fns.intUpdate(...a),
    },
    interventionUpdate: {
      create: (...a: any[]) => fns.iuCreate(...a),
    },
    interventionOutcome: {
      create: (...a: any[]) => fns.ioCreate(...a),
    },
  },
}));

import interventionRoutes from '../routes/interventions.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: MENTOR_ID, roleId: 'mentor-role-id' };
    (req as any).heldPermissions = new Set([
      'interventions:create:assigned',
      'interventions:read:assigned',
      'interventions:update:own',
      'interventions:log_outcome:own',
    ]);
    next();
  });
  app.use('/api/interventions', interventionRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(fns).forEach((fn) => fn.mockReset());
});

const SAMPLE_INTERVENTION = {
  id: INTERVENTION_ID,
  studentId: STUDENT_ID,
  mentorId: MENTOR_ID,
  riskScoreId: null,
  title: 'Improve attendance',
  description: 'Student has missed 5 sessions',
  status: 'PENDING',
  deadline: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  student: { id: STUDENT_ID, name: 'Test Student', email: 'student@test.com' },
  mentor: { id: MENTOR_ID, name: 'Test Mentor', email: 'mentor@test.com' },
  riskScore: null,
  updates: [],
  outcome: null,
};

describe('POST /api/interventions', () => {
  const validPayload = {
    studentId: STUDENT_ID,
    title: 'Improve attendance',
    description: 'Student has missed 5 sessions in a row',
  };

  it('creates intervention for assigned student', async () => {
    fns.maFindUnique.mockResolvedValue({ mentorId: MENTOR_ID, studentId: STUDENT_ID });
    fns.intCreate.mockResolvedValue(SAMPLE_INTERVENTION);

    const res = await request(app).post('/api/interventions').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Improve attendance');
  });

  it('returns 403 for unassigned student', async () => {
    fns.maFindUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/interventions').send(validPayload);

    expect(res.status).toBe(403);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/api/interventions').send({
      studentId: STUDENT_ID,
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/interventions', () => {
  it('lists interventions', async () => {
    fns.intFindMany.mockResolvedValue([SAMPLE_INTERVENTION]);

    const res = await request(app).get('/api/interventions');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/interventions/:id', () => {
  it('returns single intervention', async () => {
    fns.intFindUnique.mockResolvedValue(SAMPLE_INTERVENTION);

    const res = await request(app).get(`/api/interventions/${INTERVENTION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(INTERVENTION_ID);
  });

  it('returns 404 when not found', async () => {
    fns.intFindUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/interventions/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/interventions/:id', () => {
  it('updates own intervention', async () => {
    fns.intFindUnique.mockResolvedValue(SAMPLE_INTERVENTION);
    fns.intUpdate.mockResolvedValue({ ...SAMPLE_INTERVENTION, status: 'IN_PROGRESS' });

    const res = await request(app).put(`/api/interventions/${INTERVENTION_ID}`).send({
      status: 'IN_PROGRESS',
    });

    expect(res.status).toBe(200);
  });

  it('returns 403 when not the creator', async () => {
    fns.intFindUnique.mockResolvedValue({ ...SAMPLE_INTERVENTION, mentorId: 'other-mentor' });

    const res = await request(app).put(`/api/interventions/${INTERVENTION_ID}`).send({
      status: 'IN_PROGRESS',
    });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/interventions/:id/updates', () => {
  it('adds progress note', async () => {
    fns.intFindUnique.mockResolvedValue(SAMPLE_INTERVENTION);
    fns.iuCreate.mockResolvedValue({ id: 'u1', interventionId: INTERVENTION_ID, note: 'Met with student', createdAt: new Date().toISOString() });

    const res = await request(app).post(`/api/interventions/${INTERVENTION_ID}/updates`).send({
      note: 'Met with student',
    });

    expect(res.status).toBe(201);
  });
});

describe('POST /api/interventions/:id/outcome', () => {
  it('logs outcome', async () => {
    fns.intFindUnique.mockResolvedValue(SAMPLE_INTERVENTION);
    fns.ioCreate.mockResolvedValue({ id: 'o1', outcome: 'IMPROVED', remarks: null });
    fns.intUpdate.mockResolvedValue({ ...SAMPLE_INTERVENTION, status: 'COMPLETED' });

    const res = await request(app).post(`/api/interventions/${INTERVENTION_ID}/outcome`).send({
      outcome: 'IMPROVED',
    });

    expect(res.status).toBe(201);
  });

  it('returns 409 when outcome already exists', async () => {
    fns.intFindUnique.mockResolvedValue({ ...SAMPLE_INTERVENTION, outcome: { id: 'existing' } });

    const res = await request(app).post(`/api/interventions/${INTERVENTION_ID}/outcome`).send({
      outcome: 'IMPROVED',
    });

    expect(res.status).toBe(409);
  });
});
