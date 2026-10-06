import express from 'express';
import request from 'supertest';

const mocks = {
  batchFindUnique: jest.fn(),
  batchMemberFindMany: jest.fn(),
  sessionFindMany: jest.fn(),
  attendanceFindMany: jest.fn(),
  assessmentFindMany: jest.fn(),
  assessmentResultFindMany: jest.fn(),
  eventFindMany: jest.fn(),
  eventRegistrationFindMany: jest.fn(),
  proofSubmissionFindMany: jest.fn(),
};

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    batch: { findUnique: (...a: any[]) => mocks.batchFindUnique(...a) },
    batchMember: { findMany: (...a: any[]) => mocks.batchMemberFindMany(...a) },
    session: { findMany: (...a: any[]) => mocks.sessionFindMany(...a) },
    attendance: { findMany: (...a: any[]) => mocks.attendanceFindMany(...a) },
    assessment: { findMany: (...a: any[]) => mocks.assessmentFindMany(...a) },
    assessmentResult: { findMany: (...a: any[]) => mocks.assessmentResultFindMany(...a) },
    event: { findMany: (...a: any[]) => mocks.eventFindMany(...a) },
    eventRegistration: { findMany: (...a: any[]) => mocks.eventRegistrationFindMany(...a) },
    proofSubmission: { findMany: (...a: any[]) => mocks.proofSubmissionFindMany(...a) },
  },
}));

import leaderboardRoutes from '../routes/leaderboard.routes';
import { errorHandler } from '../middleware/error.middleware';

const BATCH_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const STUDENT_ID = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

function createApp(withAuth = true) {
  const app = express();
  app.use(express.json());
  if (withAuth) {
    app.use((req, _res, next) => {
      req.user = { sub: STUDENT_ID, roleId: 'student-role' } as any;
      next();
    });
  }
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use(errorHandler);
  return app;
}

function setupDefaults() {
  mocks.batchFindUnique.mockResolvedValue({ id: BATCH_ID, name: 'Test Batch' });
  mocks.batchMemberFindMany.mockResolvedValue([
    { student: { id: STUDENT_ID, name: 'Alice Johnson', status: 'ACTIVE' } },
  ]);
  mocks.sessionFindMany.mockResolvedValue([]);
  mocks.attendanceFindMany.mockResolvedValue([]);
  mocks.assessmentFindMany.mockResolvedValue([]);
  mocks.assessmentResultFindMany.mockResolvedValue([]);
  mocks.eventFindMany.mockResolvedValue([]);
  mocks.eventRegistrationFindMany.mockResolvedValue([]);
  mocks.proofSubmissionFindMany.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  setupDefaults();
});

const app = createApp();

describe('GET /api/leaderboard/batch/:batchId', () => {
  it('200 — successful request with valid data', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('batch');
    expect(res.body.data).toHaveProperty('week');
    expect(res.body.data).toHaveProperty('rankings');
    expect(res.body.data).toHaveProperty('contestDataAvailable');
  });

  it('200 — omitted week defaults to current week', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.week.start).toBeTruthy();
  });

  it('400 — invalid UUID', async () => {
    const res = await request(app)
      .get('/api/leaderboard/batch/not-a-uuid')
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('400 — non-Monday week', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-10-07`)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('400 — invalid week format', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=not-a-date`)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('404 — batch not found', async () => {
    mocks.batchFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(404);

    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Batch not found');
  });

  it('response structure matches expected schema', async () => {
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: STUDENT_ID, status: 'PRESENT' },
    ]);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    const data = res.body.data;
    expect(data.batch).toEqual({ id: BATCH_ID, name: 'Test Batch' });
    expect(data.week).toHaveProperty('start', '2026-01-05');
    expect(data.week).toHaveProperty('end', '2026-01-11');
    expect(data.week).toHaveProperty('label');
    expect(typeof data.generatedAt).toBe('string');
    expect(typeof data.totalStudents).toBe('number');
    expect(typeof data.contestDataAvailable).toBe('boolean');
    expect(Array.isArray(data.rankings)).toBe(true);

    const ranking = data.rankings[0];
    expect(ranking).toHaveProperty('rank', 1);
    expect(ranking).toHaveProperty('studentId');
    expect(ranking).toHaveProperty('studentName');
    expect(ranking).toHaveProperty('attendanceScore');
    expect(ranking).toHaveProperty('assessmentScore');
    expect(ranking).toHaveProperty('contestScore');
    expect(ranking).toHaveProperty('finalScore');
    expect(ranking).toHaveProperty('breakdown');
    expect(ranking.breakdown).toHaveProperty('attendanceWeighted');
    expect(ranking.breakdown).toHaveProperty('assessmentWeighted');
    expect(ranking.breakdown).toHaveProperty('contestWeighted');
  });

  it('rankings sorted by finalScore DESC', async () => {
    mocks.batchMemberFindMany.mockResolvedValue([
      { student: { id: 's1', name: 'Alice', status: 'ACTIVE' } },
      { student: { id: 's2', name: 'Bob', status: 'ACTIVE' } },
    ]);

    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's2', status: 'PRESENT' },
      { studentId: 's2', status: 'PRESENT' },
    ]);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    const rankings = res.body.data.rankings;
    expect(rankings.length).toBe(2);
    expect(rankings[0].finalScore).toBeGreaterThanOrEqual(rankings[1].finalScore);
  });

  it('returns max 10 students', async () => {
    const students = Array.from({ length: 15 }, (_, i) => ({
      student: { id: `s${i}`, name: `Student ${i}`, status: 'ACTIVE' },
    }));
    mocks.batchMemberFindMany.mockResolvedValue(students);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    expect(res.body.data.rankings.length).toBe(10);
    expect(res.body.data.totalStudents).toBe(15);
  });

  it('contestDataAvailable false when no events', async () => {
    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    expect(res.body.data.contestDataAvailable).toBe(false);
  });

  it('contestDataAvailable true when events exist', async () => {
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }]);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    expect(res.body.data.contestDataAvailable).toBe(true);
  });

  it('empty batch returns empty rankings', async () => {
    mocks.batchMemberFindMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/api/leaderboard/batch/${BATCH_ID}?week=2026-01-05`)
      .expect(200);

    expect(res.body.data.rankings).toEqual([]);
    expect(res.body.data.totalStudents).toBe(0);
  });
});
