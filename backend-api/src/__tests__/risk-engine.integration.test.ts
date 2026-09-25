import express from 'express';
import request from 'supertest';

const UUID1 = '00000000-0000-4000-a000-000000000001';
const UUID2 = '00000000-0000-4000-a000-000000000002';
const UUID3 = '00000000-0000-4000-a000-000000000003';
const UUID4 = '00000000-0000-4000-a000-000000000004';
const BATCH_A = '00000000-0000-4000-a000-0000000000a1';
const BATCH_B = '00000000-0000-4000-a000-0000000000b1';
const TRAINER_ID = '00000000-0000-4000-a000-000000000t01';
const ADMIN_ROLE = 'role-admin';
const TRAINER_ROLE = 'role-trainer';
const STUDENT_ROLE = 'role-student';
const MENTOR_ROLE = 'role-mentor';
const FACULTY_ROLE = 'role-faculty';

let riskScoreCreateCounter = 0;
const createdRiskScores: any[] = [];

const fns = {
  batchMemberFindUnique: jest.fn(),
  batchMemberFindMany: jest.fn(),
  batchFindUnique: jest.fn(),
  sessionFindMany: jest.fn(),
  attendanceFindMany: jest.fn(),
  assessmentResultFindMany: jest.fn(),
  feedbackFindMany: jest.fn(),
  riskScoreCreate: jest.fn(),
  riskScoreFindFirst: jest.fn(),
  riskScoreFindMany: jest.fn(),
  rolePermissionFindMany: jest.fn(),
  batchTrainerFindMany: jest.fn(),
  mentorAssignmentFindUnique: jest.fn(),
  mentorAssignmentFindMany: jest.fn(),
};

const mockGetMlPrediction = jest.fn();
jest.mock('../services/ml.service', () => ({
  __esModule: true,
  getMlPrediction: (...a: any[]) => mockGetMlPrediction(...a),
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    batchMember: {
      findUnique: (...a: any[]) => fns.batchMemberFindUnique(...a),
      findMany: (...a: any[]) => fns.batchMemberFindMany(...a),
      findFirst: (...a: any[]) => fns.batchMemberFindMany(...a).then((r: any[]) => r[0] || null),
    },
    batch: {
      findUnique: (...a: any[]) => fns.batchFindUnique(...a),
    },
    session: {
      findMany: (...a: any[]) => fns.sessionFindMany(...a),
    },
    attendance: {
      findMany: (...a: any[]) => fns.attendanceFindMany(...a),
    },
    assessmentResult: {
      findMany: (...a: any[]) => fns.assessmentResultFindMany(...a),
    },
    feedback: {
      findMany: (...a: any[]) => fns.feedbackFindMany(...a),
    },
    riskScore: {
      create: (...a: any[]) => fns.riskScoreCreate(...a),
      findFirst: (...a: any[]) => fns.riskScoreFindFirst(...a),
      findMany: (...a: any[]) => fns.riskScoreFindMany(...a),
    },
    rolePermission: {
      findMany: (...a: any[]) => fns.rolePermissionFindMany(...a),
    },
    batchTrainer: {
      findMany: (...a: any[]) => fns.batchTrainerFindMany(...a),
    },
    mentorAssignment: {
      findUnique: (...a: any[]) => fns.mentorAssignmentFindUnique(...a),
      findMany: (...a: any[]) => fns.mentorAssignmentFindMany(...a),
    },
  },
}));

import riskRoutes from '../routes/risk.routes';
import { errorHandler } from '../middleware/error.middleware';

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
  app.use('/api/risk', riskRoutes);
  app.use(errorHandler);
  return app;
}

function setupPermissions(codes: string[]) {
  fns.rolePermissionFindMany.mockImplementation(() =>
    Promise.resolve(codes.map((code) => ({ permission: { code } }))),
  );
}

function setupStandardProviderData() {
  fns.sessionFindMany.mockResolvedValue([
    { id: 'sess-1' }, { id: 'sess-2' }, { id: 'sess-3' }, { id: 'sess-4' },
  ]);
  fns.attendanceFindMany.mockResolvedValue([
    { status: 'PRESENT' }, { status: 'PRESENT' }, { status: 'ABSENT' }, { status: 'LATE' },
  ]);
  fns.assessmentResultFindMany.mockResolvedValue([
    { score: 70, assessment: { maxScore: 100 } },
    { score: 60, assessment: { maxScore: 100 } },
  ]);
  fns.feedbackFindMany.mockResolvedValue([
    { effortRating: 4, participationRating: 4 },
    { effortRating: 3, participationRating: 3 },
  ]);
}

function setupRiskScoreCreate() {
  fns.riskScoreCreate.mockImplementation(async (args: any) => {
    riskScoreCreateCounter++;
    const record = {
      id: `risk-${riskScoreCreateCounter}`,
      ...args.data,
      generatedAt: new Date(),
    };
    createdRiskScores.push(record);
    return record;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  riskScoreCreateCounter = 0;
  createdRiskScores.length = 0;

  mockGetMlPrediction.mockResolvedValue({ status: 'NOT_READY' });

  fns.batchMemberFindUnique.mockResolvedValue({ batchId: BATCH_A, studentId: UUID1 });
  fns.batchMemberFindMany.mockResolvedValue([{ studentId: UUID1 }]);
  fns.batchFindUnique.mockResolvedValue({ id: BATCH_A, name: 'Batch A' });
  fns.batchTrainerFindMany.mockResolvedValue([{ batchId: BATCH_A }]);
  fns.mentorAssignmentFindUnique.mockResolvedValue(null);
  fns.mentorAssignmentFindMany.mockResolvedValue([]);

  setupStandardProviderData();
  setupRiskScoreCreate();
});

// ---------------------------------------------------------------------------
// Test #17: Student not found
// ---------------------------------------------------------------------------
describe('Failure and edge cases', () => {
  test('#17: Student not in batch → 404', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindUnique.mockResolvedValue(null);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // Test #22: Assessment with maxScore = 0 excluded
  test('#22: Assessment with maxScore = 0 excluded from average', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.assessmentResultFindMany.mockResolvedValue([
      { score: 80, assessment: { maxScore: 100 } },
      { score: 0, assessment: { maxScore: 0 } },
    ]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
    const factors = res.body.data.factors;
    expect(factors.ruleBased.details.averageAssessmentScore).toBe(80);
    expect(factors.ruleBased.assessmentRisk).toBe(0);
  });

  // Test #23: Provider throws error → 500
  test('#23: Provider throws error → 500', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.sessionFindMany.mockRejectedValue(new Error('DB connection lost'));
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(500);
  });

  // Test #24: Invalid studentId format → 400
  test('#24: Invalid studentId format → 400', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post('/api/risk/calculate/not-a-uuid')
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests #25-28: Scope / Batch isolation tests
// ---------------------------------------------------------------------------
describe('Scope Tests', () => {
  // Test #25: Attendance from another batch doesn't affect
  test('#25: Attendance from another batch does not affect calculation', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.sessionFindMany.mockImplementation(async (args: any) => {
      if (args.where.batchId === BATCH_A) return [{ id: 'sess-a1' }];
      return [{ id: 'sess-b1' }, { id: 'sess-b2' }];
    });
    fns.attendanceFindMany.mockImplementation(async (args: any) => {
      const sessionIds: string[] = args.where.sessionId?.in || [];
      if (sessionIds.includes('sess-a1')) return [{ status: 'PRESENT' }];
      return [{ status: 'ABSENT' }, { status: 'ABSENT' }];
    });

    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
    expect(res.body.data.factors.ruleBased.details.attendancePercentage).toBe(100);
    expect(res.body.data.attendanceRisk).toBe(0);
  });

  // Test #26: Assessment from another batch doesn't affect
  test('#26: Assessment from another batch does not affect calculation', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.assessmentResultFindMany.mockImplementation(async (args: any) => {
      if (args.where.assessment?.batchId === BATCH_A) {
        return [{ score: 80, assessment: { maxScore: 100 } }];
      }
      return [{ score: 10, assessment: { maxScore: 100 } }];
    });

    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
    expect(res.body.data.factors.ruleBased.details.averageAssessmentScore).toBe(80);
  });

  // Test #27: Feedback from another batch doesn't affect
  test('#27: Feedback from another batch does not affect calculation', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.feedbackFindMany.mockImplementation(async (args: any) => {
      if (args.where.session?.batchId === BATCH_A) {
        return [{ effortRating: 4, participationRating: 4 }];
      }
      return [{ effortRating: 1, participationRating: 1 }];
    });

    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
    expect(res.body.data.factors.ruleBased.details.negativeFeedbackPresent).toBe(false);
    expect(res.body.data.feedbackRisk).toBe(0);
  });

  // Test #28: Student not in specified batch → 404
  test('#28: Student not in specified batch → 404', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindUnique.mockResolvedValue(null);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_B });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Tests #29-30: Snapshot Tests
// ---------------------------------------------------------------------------
describe('Snapshot Tests', () => {
  // Test #29: Repeated calculation creates separate snapshots
  test('#29: Repeated calculation creates separate snapshots with different ids', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);

    await request(app).post(`/api/risk/calculate/${UUID1}`).send({ batchId: BATCH_A });
    await request(app).post(`/api/risk/calculate/${UUID1}`).send({ batchId: BATCH_A });

    expect(createdRiskScores).toHaveLength(2);
    expect(createdRiskScores[0].id).not.toBe(createdRiskScores[1].id);
  });

  // Test #30: Previous snapshot is not modified
  test('#30: Previous snapshot is not modified', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);

    await request(app).post(`/api/risk/calculate/${UUID1}`).send({ batchId: BATCH_A });
    const firstSnapshot = { ...createdRiskScores[0] };

    fns.attendanceFindMany.mockResolvedValue([{ status: 'ABSENT' }, { status: 'ABSENT' }, { status: 'ABSENT' }, { status: 'ABSENT' }]);
    await request(app).post(`/api/risk/calculate/${UUID1}`).send({ batchId: BATCH_A });

    expect(createdRiskScores[0].id).toBe(firstSnapshot.id);
    expect(createdRiskScores[0].totalScore).toBe(firstSnapshot.totalScore);
  });
});

// ---------------------------------------------------------------------------
// Tests #41-43: Batch Calculation Tests
// ---------------------------------------------------------------------------
describe('Batch Calculation Tests', () => {
  // Test #41: Partial batch failure does not discard successes
  test('#41: Partial batch failure does not discard successes', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindMany.mockResolvedValue([
      { studentId: UUID1 }, { studentId: UUID2 }, { studentId: UUID3 },
    ]);
    fns.batchMemberFindUnique.mockImplementation(async (args: any) => {
      const sid = args.where.batchId_studentId.studentId;
      if (sid === UUID2) return null;
      return { batchId: BATCH_A, studentId: sid };
    });

    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);

    expect(res.status).toBe(200);
    expect(res.body.data.succeeded).toBe(2);
    expect(res.body.data.failed).toBe(1);
    expect(res.body.data.results).toHaveLength(2);
    expect(res.body.data.errors).toHaveLength(1);
  });

  // Test #42: Correct processed/succeeded/failed counts
  test('#42: Correct processed/succeeded/failed counts', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindMany.mockResolvedValue([{ studentId: UUID1 }, { studentId: UUID2 }]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);
    expect(res.body.data.processed).toBe(2);
    expect(res.body.data.succeeded).toBe(2);
    expect(res.body.data.failed).toBe(0);
  });

  // Test #43: Empty batch returns empty results
  test('#43: Empty batch returns empty results', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(0);
    expect(res.body.data.succeeded).toBe(0);
    expect(res.body.data.results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests #44-47: Missing-Data Tests
// ---------------------------------------------------------------------------
describe('Missing-Data Tests', () => {
  // Test #44: factors contains dataAvailability
  test('#44: factors contains dataAvailability', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.body.data.factors.dataAvailability).toBeDefined();
    expect(typeof res.body.data.factors.dataAvailability.attendance).toBe('boolean');
    expect(typeof res.body.data.factors.dataAvailability.assessment).toBe('boolean');
    expect(typeof res.body.data.factors.dataAvailability.feedback).toBe('boolean');
  });

  // Test #45: Missing attendance → dataAvailability.attendance = false
  test('#45: Missing attendance → dataAvailability.attendance = false', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.sessionFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.body.data.factors.dataAvailability.attendance).toBe(false);
    expect(res.body.data.attendanceRisk).toBe(0);
  });

  // Test #46: Missing feedback → dataAvailability.feedback = false
  test('#46: Missing feedback → dataAvailability.feedback = false', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.feedbackFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.body.data.factors.dataAvailability.feedback).toBe(false);
    expect(res.body.data.feedbackRisk).toBe(0);
  });

  // Test #47: All sources missing → all flags false, score = 0
  test('#47: All sources missing → all flags false, score = 0', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.sessionFindMany.mockResolvedValue([]);
    fns.assessmentResultFindMany.mockResolvedValue([]);
    fns.feedbackFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.body.data.totalScore).toBe(0);
    expect(res.body.data.riskLevel).toBe('LOW');
    expect(res.body.data.factors.dataAvailability).toEqual({
      attendance: false,
      assessment: false,
      feedback: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests #48-61: RBAC Tests
// ---------------------------------------------------------------------------
describe('RBAC Tests', () => {
  // Test #48: ADMIN can trigger calculation → 201
  test('#48: ADMIN can trigger calculation → 201', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
  });

  // Test #49: TRAINER can trigger batch calculation for own batch → 200
  test('#49: TRAINER can trigger batch calculation for own batch → 200', async () => {
    setupPermissions(['risk_scores:calculate:batch']);
    fns.batchTrainerFindMany.mockResolvedValue([{ batchId: BATCH_A }]);
    const app = createApp(TRAINER_ID, TRAINER_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);
    expect(res.status).toBe(200);
  });

  // Test #50: STUDENT cannot trigger calculation → 403
  test('#50: STUDENT cannot trigger calculation → 403', async () => {
    setupPermissions([]);
    const app = createApp(UUID1, STUDENT_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(403);
  });

  // Test #51: MENTOR cannot trigger calculation → 403
  test('#51: MENTOR cannot trigger calculation → 403', async () => {
    setupPermissions([]);
    const app = createApp(UUID1, MENTOR_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(403);
  });

  // Test #52: TRAINER can calculate individual student risk within own batch → 201
  test('#52: TRAINER can calculate individual student risk within own batch → 201', async () => {
    setupPermissions(['risk_scores:calculate:batch']);
    fns.batchTrainerFindMany.mockResolvedValue([{ batchId: BATCH_A }]);
    const app = createApp(TRAINER_ID, TRAINER_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
  });

  // Test #53: TRAINER cannot calculate individual student risk outside own batch → 403
  test('#53: TRAINER cannot calculate individual student outside own batch → 403', async () => {
    setupPermissions(['risk_scores:calculate:batch']);
    fns.batchTrainerFindMany.mockResolvedValue([{ batchId: BATCH_A }]);
    const app = createApp(TRAINER_ID, TRAINER_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_B });
    expect(res.status).toBe(403);
  });

  // Test #54: ADMIN can calculate individual student risk for any batch → 201
  test('#54: ADMIN can calculate individual student for any batch → 201', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
  });

  // Test #55: STUDENT can read own risk score → 200
  test('#55: STUDENT can read own risk score → 200', async () => {
    setupPermissions(['risk_scores:read:own']);
    fns.riskScoreFindFirst.mockResolvedValue({
      id: 'rs-1', studentId: UUID1, riskLevel: 'LOW', totalScore: 0,
      attendanceRisk: 0, assessmentRisk: 0, feedbackRisk: 0, factors: {}, generatedAt: new Date(),
    });
    const app = createApp(UUID1, STUDENT_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID1}`);
    expect(res.status).toBe(200);
  });

  // Test #56: STUDENT cannot read another student's risk score → 403
  test('#56: STUDENT cannot read another student risk score → 403', async () => {
    setupPermissions(['risk_scores:read:own']);
    const app = createApp(UUID1, STUDENT_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID2}`);
    expect(res.status).toBe(403);
  });

  // Test #57: MENTOR can read assigned student's risk score → 200
  test('#57: MENTOR can read assigned student risk score → 200', async () => {
    setupPermissions(['risk_scores:read:assigned']);
    fns.mentorAssignmentFindUnique.mockResolvedValue({ mentorId: UUID1, studentId: UUID2 });
    fns.riskScoreFindFirst.mockResolvedValue({
      id: 'rs-2', studentId: UUID2, riskLevel: 'MEDIUM', totalScore: 20,
      attendanceRisk: 20, assessmentRisk: 0, feedbackRisk: 0, factors: {}, generatedAt: new Date(),
    });
    const app = createApp(UUID1, MENTOR_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID2}`);
    expect(res.status).toBe(200);
  });

  // Test #58: TRAINER sees only risk level (not factors/breakdown)
  test('#58: TRAINER sees only risk level, no factors or breakdown', async () => {
    setupPermissions(['risk_scores:read:category:batch']);
    fns.batchTrainerFindMany.mockResolvedValue([{ batchId: BATCH_A }]);
    fns.batchMemberFindMany.mockResolvedValue([{ studentId: UUID1, batchId: BATCH_A }]);
    fns.riskScoreFindFirst.mockResolvedValue({
      id: 'rs-3', studentId: UUID1, riskLevel: 'MEDIUM', totalScore: 35,
      attendanceRisk: 20, assessmentRisk: 0, feedbackRisk: 15,
      factors: { ruleBased: {} }, generatedAt: new Date(),
    });
    const app = createApp(TRAINER_ID, TRAINER_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID1}`);
    expect(res.status).toBe(200);
    expect(res.body.data.riskLevel).toBe('MEDIUM');
    expect(res.body.data.factors).toBeUndefined();
    expect(res.body.data.attendanceRisk).toBeUndefined();
    expect(res.body.data.assessmentRisk).toBeUndefined();
    expect(res.body.data.feedbackRisk).toBeUndefined();
    expect(res.body.data.totalScore).toBeUndefined();
  });

  // Test #59: FACULTY can read any risk score → 200 with full details
  test('#59: FACULTY can read any risk score → 200 with full details', async () => {
    setupPermissions(['risk_scores:read:any']);
    fns.riskScoreFindFirst.mockResolvedValue({
      id: 'rs-4', studentId: UUID1, riskLevel: 'LOW', totalScore: 0,
      attendanceRisk: 0, assessmentRisk: 0, feedbackRisk: 0,
      factors: { dataAvailability: {} }, generatedAt: new Date(),
    });
    const app = createApp(UUID3, FACULTY_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID1}`);
    expect(res.status).toBe(200);
    expect(res.body.data.factors).toBeDefined();
    expect(res.body.data.totalScore).toBeDefined();
  });

  // Test #60: ADMIN can list high-risk students → 200
  test('#60: ADMIN can list high-risk students → 200', async () => {
    setupPermissions(['risk_scores:read:any']);
    fns.riskScoreFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).get('/api/risk/high');
    expect(res.status).toBe(200);
  });

  // Test #61: STUDENT cannot list high-risk students → 403
  test('#61: STUDENT cannot list high-risk students → 403', async () => {
    setupPermissions([]);
    const app = createApp(UUID1, STUDENT_ROLE);
    const res = await request(app).get('/api/risk/high');
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Tests #64-71: Integration Tests (API Layer)
// ---------------------------------------------------------------------------
describe('Integration Tests (API Layer)', () => {
  // Test #64: Calculate risk for valid student → 201
  test('#64: Calculate risk for valid student → 201, persisted RiskScore', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentId).toBe(UUID1);
    expect(res.body.data.riskLevel).toBeDefined();
    expect(fns.riskScoreCreate).toHaveBeenCalled();
  });

  // Test #65: Calculate risk for nonexistent student → 404
  test('#65: Calculate risk for nonexistent student → 404', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindUnique.mockResolvedValue(null);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID2}`)
      .send({ batchId: BATCH_A });
    expect(res.status).toBe(404);
  });

  // Test #66: Calculate risk without batchId → 400
  test('#66: Calculate risk without batchId → 400 (Joi validation)', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app)
      .post(`/api/risk/calculate/${UUID1}`)
      .send({});
    expect(res.status).toBe(400);
  });

  // Test #67: Batch calculate for valid batch → 200
  test('#67: Batch calculate for valid batch → 200, partial success response', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindMany.mockResolvedValue([{ studentId: UUID1 }, { studentId: UUID2 }]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);
    expect(res.status).toBe(200);
    expect(res.body.data.batchId).toBe(BATCH_A);
    expect(res.body.data.processed).toBe(2);
  });

  // Test #68: Batch calculate for empty batch → 200, processed = 0
  test('#68: Batch calculate for empty batch → 200, processed = 0', async () => {
    setupPermissions(['risk_scores:calculate:any']);
    fns.batchMemberFindMany.mockResolvedValue([]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).post(`/api/risk/calculate/batch/${BATCH_A}`);
    expect(res.status).toBe(200);
    expect(res.body.data.processed).toBe(0);
  });

  // Test #69: Get latest risk score → 200
  test('#69: Get latest risk score → 200, most recent score', async () => {
    setupPermissions(['risk_scores:read:any']);
    fns.riskScoreFindFirst.mockResolvedValue({
      id: 'rs-latest', studentId: UUID1, riskLevel: 'LOW', totalScore: 0,
      attendanceRisk: 0, assessmentRisk: 0, feedbackRisk: 0,
      factors: {}, generatedAt: new Date(),
    });
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID1}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('rs-latest');
  });

  // Test #70: Get risk history → 200
  test('#70: Get risk history → 200, array ordered by generatedAt desc', async () => {
    setupPermissions(['risk_scores:read:any']);
    fns.riskScoreFindMany.mockResolvedValue([
      { id: 'rs-2', generatedAt: new Date('2026-09-25') },
      { id: 'rs-1', generatedAt: new Date('2026-09-24') },
    ]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).get(`/api/risk/student/${UUID1}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  // Test #71: Get high-risk students → 200
  test('#71: Get high-risk students → 200, filtered list', async () => {
    setupPermissions(['risk_scores:read:any']);
    fns.riskScoreFindMany.mockResolvedValue([
      { id: 'rs-high', studentId: UUID1, riskLevel: 'HIGH' },
    ]);
    const app = createApp(UUID1, ADMIN_ROLE);
    const res = await request(app).get('/api/risk/high');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
