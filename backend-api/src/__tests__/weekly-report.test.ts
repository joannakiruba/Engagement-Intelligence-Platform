import express from 'express';
import request from 'supertest';

const MENTOR_ID = '00000000-0000-4000-a000-00000000m001';
const MENTOR2_ID = '00000000-0000-4000-a000-00000000m002';
const STUDENT_A = '00000000-0000-4000-a000-000000000a01';
const STUDENT_B = '00000000-0000-4000-a000-000000000a02';
const STUDENT_C = '00000000-0000-4000-a000-000000000a03';
const BATCH_X = '00000000-0000-4000-a000-0000000000x1';
const BATCH_Y = '00000000-0000-4000-a000-0000000000y1';
const ADMIN_ROLE = 'role-admin';
const MENTOR_ROLE = 'role-mentor';
const STUDENT_ROLE = 'role-student';
const TRAINER_ROLE = 'role-trainer';

const fns = {
  userFindUnique: jest.fn(),
  mentorAssignmentFindMany: jest.fn(),
  riskScoreFindMany: jest.fn(),
  rolePermissionFindMany: jest.fn(),
  batchTrainerFindMany: jest.fn(),
  mentorAssignmentFindUnique: jest.fn(),
};

const mockQueueWeeklyReport = jest.fn();
jest.mock('../jobs/queue', () => ({
  __esModule: true,
  queueWeeklyReport: (...a: any[]) => mockQueueWeeklyReport(...a),
  weeklyReportQueue: { add: jest.fn() },
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...a: any[]) => fns.userFindUnique(...a),
    },
    mentorAssignment: {
      findMany: (...a: any[]) => fns.mentorAssignmentFindMany(...a),
      findUnique: (...a: any[]) => fns.mentorAssignmentFindUnique(...a),
    },
    riskScore: {
      findMany: (...a: any[]) => fns.riskScoreFindMany(...a),
    },
    rolePermission: {
      findMany: (...a: any[]) => fns.rolePermissionFindMany(...a),
    },
    batchTrainer: {
      findMany: (...a: any[]) => fns.batchTrainerFindMany(...a),
    },
  },
}));

import weeklyReportRoutes from '../routes/weekly-report.routes';
import { errorHandler } from '../middleware/error.middleware';
import {
  computeWeekBounds,
  validateDateRange,
  generateWeeklyReportData,
} from '../services/weekly-report.service';

function mockAuth(userId: string, roleId: string) {
  return (req: any, _res: any, next: any) => {
    req.user = { sub: userId, roleId, exp: Math.floor(Date.now() / 1000) + 3600 };
    next();
  };
}

function createApp(userId: string, roleId: string) {
  const app = express();
  app.use(express.json());
  app.use(mockAuth(userId, roleId));
  app.use('/api/weekly-reports', weeklyReportRoutes);
  app.use(errorHandler);
  return app;
}

function setupPermissions(codes: string[]) {
  fns.rolePermissionFindMany.mockImplementation(() =>
    Promise.resolve(codes.map((code) => ({ permission: { code } }))),
  );
}

function makeScore(
  id: string,
  studentId: string,
  studentName: string,
  riskLevel: string,
  totalScore: number,
  generatedAt: Date,
  batchId: string | null = BATCH_X,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    studentId,
    riskLevel,
    totalScore,
    attendanceRisk: overrides.attendanceRisk ?? 0,
    assessmentRisk: overrides.assessmentRisk ?? 0,
    feedbackRisk: overrides.feedbackRisk ?? 0,
    generatedAt,
    student: { name: studentName },
    factors: {
      scope: { batchId },
      dataAvailability: overrides.dataAvailability ?? {
        attendance: true,
        assessment: true,
        feedback: true,
      },
      ruleBased: {
        attendanceRisk: overrides.attendanceRisk ?? 0,
        assessmentRisk: overrides.assessmentRisk ?? 0,
        feedbackRisk: overrides.feedbackRisk ?? 0,
        totalScore,
        riskLevel,
        details: overrides.details ?? {
          attendancePercentage: 80,
          averageAssessmentScore: 60,
          negativeFeedbackPresent: false,
        },
      },
      ml: { status: 'NOT_READY' },
      final: { riskLevel, decidedBy: 'RULE_ENGINE' },
    },
  };
}

const WEEK_START = new Date('2026-09-28T00:00:00.000Z');
const WEEK_END = new Date('2026-10-05T00:00:00.000Z');

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueWeeklyReport.mockResolvedValue(undefined);

  fns.userFindUnique.mockResolvedValue({
    id: MENTOR_ID,
    name: 'Test Mentor',
    email: 'mentor@test.com',
  });

  fns.mentorAssignmentFindMany.mockResolvedValue([
    { mentorId: MENTOR_ID, studentId: STUDENT_A, student: { id: STUDENT_A, name: 'Alice' } },
    { mentorId: MENTOR_ID, studentId: STUDENT_B, student: { id: STUDENT_B, name: 'Bob' } },
  ]);

  fns.mentorAssignmentFindUnique.mockResolvedValue(null);
  fns.batchTrainerFindMany.mockResolvedValue([]);
  fns.riskScoreFindMany.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Unit tests — computeWeekBounds (timezone-aware)
// ---------------------------------------------------------------------------
describe('computeWeekBounds', () => {
  test('Asia/Kolkata: 2026-09-28 IST week = 2026-09-27T18:30Z to 2026-10-04T18:30Z', () => {
    // Reference: Monday 2026-10-05 09:00 IST = 2026-10-05T03:30:00Z
    const ref = new Date('2026-10-05T03:30:00.000Z');
    const { weekStart, weekEnd } = computeWeekBounds(ref, 'Asia/Kolkata');
    expect(weekStart.toISOString()).toBe('2026-09-27T18:30:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });

  test('consecutive weeks in Asia/Kolkata do not overlap', () => {
    const week1 = computeWeekBounds(new Date('2026-10-05T03:30:00Z'), 'Asia/Kolkata');
    const week2 = computeWeekBounds(new Date('2026-10-12T03:30:00Z'), 'Asia/Kolkata');
    expect(week1.weekEnd.toISOString()).toBe(week2.weekStart.toISOString());
  });

  test('Sunday evening UTC (before IST Monday) still returns previous week', () => {
    // 2026-10-04T20:00:00Z = 2026-10-05 01:30 IST (Monday early AM)
    // The most recent Monday is 2026-10-05 itself
    const ref = new Date('2026-10-04T20:00:00.000Z');
    const { weekStart, weekEnd } = computeWeekBounds(ref, 'Asia/Kolkata');
    // In IST it's Monday 01:30, so the completed week ended at Monday 00:00 IST
    expect(weekEnd.toISOString()).toBe('2026-10-04T18:30:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-09-27T18:30:00.000Z');
  });

  test('UTC timezone gives Monday 00:00 UTC boundaries', () => {
    const ref = new Date('2026-10-07T14:00:00Z'); // Wednesday UTC
    const { weekStart, weekEnd } = computeWeekBounds(ref, 'UTC');
    expect(weekEnd.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(weekStart.toISOString()).toBe('2026-09-28T00:00:00.000Z');
  });

  test('year rollover: reference in first week of January', () => {
    // 2027-01-04 is a Monday (in IST)
    const ref = new Date('2027-01-04T03:30:00.000Z'); // Mon 09:00 IST
    const { weekStart, weekEnd } = computeWeekBounds(ref, 'Asia/Kolkata');
    // Previous Monday IST = 2026-12-28 00:00 IST = 2026-12-27T18:30Z
    // This Monday IST = 2027-01-04 00:00 IST = 2027-01-03T18:30Z
    expect(weekStart.toISOString()).toBe('2026-12-27T18:30:00.000Z');
    expect(weekEnd.toISOString()).toBe('2027-01-03T18:30:00.000Z');
  });

  test('defaults to Asia/Kolkata when no timezone provided', () => {
    const ref = new Date('2026-10-05T03:30:00.000Z');
    const { weekStart, weekEnd } = computeWeekBounds(ref);
    expect(weekStart.toISOString()).toBe('2026-09-27T18:30:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// Correct latest-score selection BEFORE filtering
// ---------------------------------------------------------------------------
describe('Latest-score selection', () => {
  test('student whose latest score is LOW is excluded even if they had earlier MEDIUM', async () => {
    const olderMedium = makeScore('rs-1', STUDENT_A, 'Alice', 'MEDIUM', 35,
      new Date('2026-09-29T10:00:00Z'));
    const newerLow = makeScore('rs-2', STUDENT_A, 'Alice', 'LOW', 0,
      new Date('2026-10-03T10:00:00Z'));
    const bobHigh = makeScore('rs-3', STUDENT_B, 'Bob', 'HIGH', 60,
      new Date('2026-10-01T10:00:00Z'));

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      const lt = args.where.generatedAt?.lt;
      if (gte && lt && gte.getTime() === WEEK_START.getTime() && lt.getTime() === WEEK_END.getTime()) {
        return [newerLow, olderMedium, bobHigh]; // desc order
      }
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    const names = report.students.map((s) => s.name);
    expect(names).not.toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('student with only MEDIUM/HIGH latest is included', async () => {
    const medium = makeScore('rs-1', STUDENT_A, 'Alice', 'MEDIUM', 45,
      new Date('2026-10-02T10:00:00Z'));

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      const lt = args.where.generatedAt?.lt;
      if (gte?.getTime() === WEEK_START.getTime() && lt?.getTime() === WEEK_END.getTime()) {
        return [medium];
      }
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students).toHaveLength(1);
    expect(report.students[0].name).toBe('Alice');
    expect(report.students[0].riskLevel).toBe('MEDIUM');
  });
});

// ---------------------------------------------------------------------------
// Non-overlapping weekly periods
// ---------------------------------------------------------------------------
describe('Non-overlapping periods', () => {
  test('score at exact weekStart boundary belongs to current week only', async () => {
    const boundaryScore = makeScore('rs-boundary', STUDENT_A, 'Alice', 'HIGH', 60,
      new Date(WEEK_START.toISOString()));

    const calls: Array<{ gte: Date; lt: Date }> = [];
    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const { gte, lt } = args.where.generatedAt || {};
      if (gte && lt) calls.push({ gte, lt });
      if (gte?.getTime() === WEEK_START.getTime()) return [boundaryScore];
      return [];
    });

    await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);

    // Verify both queries use exclusive end (lt, not lte)
    for (const call of calls) {
      expect(call.lt).toBeDefined();
    }

    // Previous week query should use lt: weekStart, so boundary score is excluded
    const prevWeekCall = calls.find(
      (c) => c.gte.getTime() < WEEK_START.getTime(),
    );
    expect(prevWeekCall).toBeDefined();
    expect(prevWeekCall!.lt.getTime()).toBe(WEEK_START.getTime());
  });
});

// ---------------------------------------------------------------------------
// Reasons from stored risk data
// ---------------------------------------------------------------------------
describe('Reasons extraction', () => {
  test('includes attendance, assessment, and feedback reasons from factors', async () => {
    const score = makeScore('rs-1', STUDENT_A, 'Alice', 'MEDIUM', 60,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, {
        attendanceRisk: 20,
        assessmentRisk: 25,
        feedbackRisk: 15,
        details: {
          attendancePercentage: 68.5,
          averageAssessmentScore: 42.3,
          negativeFeedbackPresent: true,
        },
      });

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      if (args.where.generatedAt?.gte?.getTime() === WEEK_START.getTime()) {
        return [score];
      }
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].reasons).toContain('Low attendance: 68.5%');
    expect(report.students[0].reasons).toContain('Low assessment score: 42.3%');
    expect(report.students[0].reasons).toContain('Negative feedback detected');
  });

  test('student with no specific reasons gets fallback message', async () => {
    const score = makeScore('rs-1', STUDENT_A, 'Alice', 'MEDIUM', 35,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, {
        attendanceRisk: 0,
        assessmentRisk: 0,
        feedbackRisk: 0,
      });
    // Manually override riskLevel to MEDIUM despite zero risk scores
    // (could happen via ML escalation)
    score.riskLevel = 'MEDIUM';
    (score.factors as any).final.riskLevel = 'MEDIUM';

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      if (args.where.generatedAt?.gte?.getTime() === WEEK_START.getTime()) {
        return [score];
      }
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].reasons).toEqual(['Elevated risk from combined factors']);
  });
});

// ---------------------------------------------------------------------------
// Previous-week comparisons without mixing batch contexts
// ---------------------------------------------------------------------------
describe('Batch-context-aware comparisons', () => {
  test('trend compares scores from the same batch', async () => {
    const currentScore = makeScore('rs-c', STUDENT_A, 'Alice', 'MEDIUM', 45,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, { attendanceRisk: 20, assessmentRisk: 25 });
    const prevScore = makeScore('rs-p', STUDENT_A, 'Alice', 'LOW', 20,
      new Date('2026-09-25T10:00:00Z'), BATCH_X, { attendanceRisk: 20 });

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      if (gte?.getTime() === WEEK_START.getTime()) return [currentScore];
      return [prevScore];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].trend).toBe('↑ Worsening');
  });

  test('trend shows N/A when previous score is from a different batch', async () => {
    const currentScore = makeScore('rs-c', STUDENT_A, 'Alice', 'MEDIUM', 45,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, { attendanceRisk: 20, assessmentRisk: 25 });
    const prevScore = makeScore('rs-p', STUDENT_A, 'Alice', 'LOW', 20,
      new Date('2026-09-25T10:00:00Z'), BATCH_Y, { attendanceRisk: 20 });

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      if (gte?.getTime() === WEEK_START.getTime()) return [currentScore];
      return [prevScore];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].trend).toBe('N/A (different batch)');
  });

  test('trend shows N/A when no previous week score exists', async () => {
    const currentScore = makeScore('rs-c', STUDENT_A, 'Alice', 'HIGH', 60,
      new Date('2026-10-01T10:00:00Z'));

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      if (gte?.getTime() === WEEK_START.getTime()) return [currentScore];
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].trend).toBe('N/A');
  });

  test('improving trend when score decreases by more than 5', async () => {
    const currentScore = makeScore('rs-c', STUDENT_A, 'Alice', 'MEDIUM', 35,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, { attendanceRisk: 20, feedbackRisk: 15 });
    const prevScore = makeScore('rs-p', STUDENT_A, 'Alice', 'MEDIUM', 45,
      new Date('2026-09-25T10:00:00Z'), BATCH_X);

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      if (gte?.getTime() === WEEK_START.getTime()) return [currentScore];
      return [prevScore];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].trend).toBe('↓ Improving');
  });

  test('stable trend when score changes by 5 or less', async () => {
    const currentScore = makeScore('rs-c', STUDENT_A, 'Alice', 'MEDIUM', 43,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, { attendanceRisk: 20, assessmentRisk: 23 });
    const prevScore = makeScore('rs-p', STUDENT_A, 'Alice', 'MEDIUM', 45,
      new Date('2026-09-25T10:00:00Z'), BATCH_X);

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      const gte = args.where.generatedAt?.gte;
      if (gte?.getTime() === WEEK_START.getTime()) return [currentScore];
      return [prevScore];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].trend).toBe('→ Stable');
  });
});

// ---------------------------------------------------------------------------
// Missing-data handling
// ---------------------------------------------------------------------------
describe('Missing-data handling', () => {
  test('reports dataAvailability from factors', async () => {
    const score = makeScore('rs-1', STUDENT_A, 'Alice', 'MEDIUM', 35,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, {
        attendanceRisk: 20,
        feedbackRisk: 15,
        dataAvailability: { attendance: true, assessment: false, feedback: true },
      });

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      if (args.where.generatedAt?.gte?.getTime() === WEEK_START.getTime()) return [score];
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].dataAvailability).toEqual({
      attendance: true,
      assessment: false,
      feedback: true,
    });
  });

  test('returns null dataAvailability when factors lack the field', async () => {
    const score = makeScore('rs-1', STUDENT_A, 'Alice', 'HIGH', 60,
      new Date('2026-10-01T10:00:00Z'));
    (score.factors as any).dataAvailability = undefined;

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      if (args.where.generatedAt?.gte?.getTime() === WEEK_START.getTime()) return [score];
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].dataAvailability).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  test('mentor with no assigned students returns empty report', async () => {
    fns.mentorAssignmentFindMany.mockResolvedValue([]);
    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students).toEqual([]);
    expect(report.mentorName).toBe('Test Mentor');
  });

  test('no risk scores in the period returns empty students array', async () => {
    fns.riskScoreFindMany.mockResolvedValue([]);
    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students).toEqual([]);
  });

  test('mentor not found throws ServiceError 404', async () => {
    fns.userFindUnique.mockResolvedValue(null);
    await expect(
      generateWeeklyReportData('nonexistent', WEEK_START, WEEK_END),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('students are sorted by riskScore descending', async () => {
    const alice = makeScore('rs-a', STUDENT_A, 'Alice', 'MEDIUM', 35,
      new Date('2026-10-01T10:00:00Z'), BATCH_X, { attendanceRisk: 20, feedbackRisk: 15 });
    const bob = makeScore('rs-b', STUDENT_B, 'Bob', 'HIGH', 60,
      new Date('2026-10-02T10:00:00Z'), BATCH_X, {
        attendanceRisk: 20, assessmentRisk: 25, feedbackRisk: 15,
      });

    fns.riskScoreFindMany.mockImplementation(async (args: any) => {
      if (args.where.generatedAt?.gte?.getTime() === WEEK_START.getTime()) {
        return [bob, alice]; // already desc by generatedAt
      }
      return [];
    });

    const report = await generateWeeklyReportData(MENTOR_ID, WEEK_START, WEEK_END);
    expect(report.students[0].name).toBe('Bob');
    expect(report.students[1].name).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// Date range validation
// ---------------------------------------------------------------------------
describe('validateDateRange', () => {
  test('accepts a valid 7-day range', () => {
    expect(() => validateDateRange(WEEK_START, WEEK_END)).not.toThrow();
  });

  test('rejects reversed dates (end before start)', () => {
    expect(() => validateDateRange(WEEK_END, WEEK_START)).toThrow('weekEnd must be after weekStart');
  });

  test('rejects equal start and end', () => {
    expect(() => validateDateRange(WEEK_START, new Date(WEEK_START))).toThrow('weekEnd must be after weekStart');
  });

  test('rejects range exceeding 31 days', () => {
    const farEnd = new Date(WEEK_START);
    farEnd.setUTCDate(farEnd.getUTCDate() + 32);
    expect(() => validateDateRange(WEEK_START, farEnd)).toThrow('must not exceed 31 days');
  });

  test('rejects invalid weekStart date', () => {
    expect(() => validateDateRange(new Date('not-a-date'), WEEK_END)).toThrow('Invalid weekStart');
  });

  test('rejects invalid weekEnd date', () => {
    expect(() => validateDateRange(WEEK_START, new Date('garbage'))).toThrow('Invalid weekEnd');
  });
});

// ---------------------------------------------------------------------------
// API Layer — Preview Endpoint
// ---------------------------------------------------------------------------
describe('Preview endpoint', () => {
  test('MENTOR can preview own report → 200', async () => {
    setupPermissions(['weekly_reports:read:assigned']);
    fns.riskScoreFindMany.mockResolvedValue([]);

    const app = createApp(MENTOR_ID, MENTOR_ROLE);
    const res = await request(app).get('/api/weekly-reports/preview');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.mentorId).toBe(MENTOR_ID);
  });

  test('ADMIN can preview any mentor report → 200', async () => {
    setupPermissions(['weekly_reports:read:any']);
    fns.userFindUnique.mockResolvedValue({
      id: MENTOR2_ID, name: 'Other Mentor', email: 'other@test.com',
    });
    fns.mentorAssignmentFindMany.mockResolvedValue([]);
    fns.riskScoreFindMany.mockResolvedValue([]);

    const app = createApp('admin-1', ADMIN_ROLE);
    const res = await request(app)
      .get('/api/weekly-reports/preview')
      .query({ mentorId: MENTOR2_ID });
    expect(res.status).toBe(200);
    expect(res.body.data.mentorId).toBe(MENTOR2_ID);
  });

  test('STUDENT cannot preview reports → 403', async () => {
    setupPermissions([]);
    const app = createApp(STUDENT_A, STUDENT_ROLE);
    const res = await request(app).get('/api/weekly-reports/preview');
    expect(res.status).toBe(403);
  });

  test('TRAINER cannot preview reports → 403', async () => {
    setupPermissions([]);
    const app = createApp('trainer-1', TRAINER_ROLE);
    const res = await request(app).get('/api/weekly-reports/preview');
    expect(res.status).toBe(403);
  });

  test('accepts custom weekStart and weekEnd query params', async () => {
    setupPermissions(['weekly_reports:read:any']);
    fns.riskScoreFindMany.mockResolvedValue([]);

    const app = createApp(MENTOR_ID, ADMIN_ROLE);
    const res = await request(app)
      .get('/api/weekly-reports/preview')
      .query({
        weekStart: '2026-09-21T00:00:00.000Z',
        weekEnd: '2026-09-28T00:00:00.000Z',
      });
    expect(res.status).toBe(200);
    expect(new Date(res.body.data.weekStart).toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  test('rejects partial custom range (only weekStart) → 400', async () => {
    setupPermissions(['weekly_reports:read:any']);
    const app = createApp(MENTOR_ID, ADMIN_ROLE);
    const res = await request(app)
      .get('/api/weekly-reports/preview')
      .query({ weekStart: '2026-09-21T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Both weekStart and weekEnd/);
  });

  test('rejects reversed custom date range → 400', async () => {
    setupPermissions(['weekly_reports:read:any']);
    const app = createApp(MENTOR_ID, ADMIN_ROLE);
    const res = await request(app)
      .get('/api/weekly-reports/preview')
      .query({
        weekStart: '2026-10-05T00:00:00.000Z',
        weekEnd: '2026-09-28T00:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// API Layer — Trigger Endpoint
// ---------------------------------------------------------------------------
describe('Trigger endpoint', () => {
  test('ADMIN can trigger weekly reports → 202', async () => {
    setupPermissions(['weekly_reports:trigger']);
    fns.mentorAssignmentFindMany.mockResolvedValue([
      { mentorId: MENTOR_ID },
      { mentorId: MENTOR2_ID },
    ]);

    const app = createApp('admin-1', ADMIN_ROLE);
    const res = await request(app).post('/api/weekly-reports/trigger');
    expect(res.status).toBe(202);
    expect(res.body.data.queued).toBe(2);
  });

  test('MENTOR cannot trigger reports → 403', async () => {
    setupPermissions([]);
    const app = createApp(MENTOR_ID, MENTOR_ROLE);
    const res = await request(app).post('/api/weekly-reports/trigger');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// API Layer — Schedule Endpoint
// ---------------------------------------------------------------------------
describe('Schedule endpoint', () => {
  test('returns schedule configuration with Asia/Kolkata defaults', async () => {
    setupPermissions(['weekly_reports:read:any']);
    const app = createApp(MENTOR_ID, ADMIN_ROLE);
    const res = await request(app).get('/api/weekly-reports/schedule');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('enabled');
    expect(res.body.data).toHaveProperty('dayOfWeek');
    expect(res.body.data).toHaveProperty('hour');
    expect(res.body.data).toHaveProperty('cronExpression');
    expect(res.body.data.timezone).toBe('Asia/Kolkata');
    expect(res.body.data.hour).toBe(9);
    expect(res.body.data.dayOfWeek).toBe(1);
    expect(res.body.data.cronExpression).toBe('0 9 * * 1');
  });
});
