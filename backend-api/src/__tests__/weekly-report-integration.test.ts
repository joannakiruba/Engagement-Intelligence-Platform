/**
 * Integration tests for weekly-report.service against a real PostgreSQL database.
 *
 * Requires: DATABASE_URL pointing at a disposable PostgreSQL instance with schema pushed.
 * Run:  DATABASE_URL='postgresql://test:test@localhost:5433/eip_test' \
 *       npx jest --testPathPatterns='weekly-report-integration' --no-coverage --forceExit
 */
import { PrismaClient, RiskLevel, UserStatus } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

// Isolated import so the service uses the same DATABASE_URL-connected prisma
// We'll call the service functions directly — they use the prisma singleton from ../lib/prisma,
// so we must ensure that module also picks up DATABASE_URL. We handle that by setting the env var
// before anything loads.

import {
  generateWeeklyReportData,
  computeWeekBounds,
  validateDateRange,
} from '../services/weekly-report.service';

const WEEK_START = new Date('2026-09-28T00:00:00.000Z');
const WEEK_END = new Date('2026-10-05T00:00:00.000Z');
const PREV_WEEK_START = new Date('2026-09-21T00:00:00.000Z');

let roleId: string;
let mentorId: string;
let studentAId: string;
let studentBId: string;
let studentCId: string;

beforeAll(async () => {
  // Use an existing role or create one — don't nuke the DB
  let role = await prisma.role.findFirst({ where: { name: 'MENTOR_INTEG_TEST' } });
  if (!role) {
    role = await prisma.role.create({
      data: { name: 'MENTOR_INTEG_TEST', description: 'Integration test role' },
    });
  }
  roleId = role.id;

  const mentor = await prisma.user.create({
    data: {
      name: 'Dr. Integration Mentor',
      email: 'mentor-integ@test.local',
      roleId,
      status: UserStatus.ACTIVE,
    },
  });
  mentorId = mentor.id;

  const studentA = await prisma.user.create({
    data: {
      name: 'Alice Student',
      email: 'alice-integ@test.local',
      roleId,
      status: UserStatus.ACTIVE,
    },
  });
  studentAId = studentA.id;

  const studentB = await prisma.user.create({
    data: {
      name: 'Bob Student',
      email: 'bob-integ@test.local',
      roleId,
      status: UserStatus.ACTIVE,
    },
  });
  studentBId = studentB.id;

  const studentC = await prisma.user.create({
    data: {
      name: 'Charlie Student',
      email: 'charlie-integ@test.local',
      roleId,
      status: UserStatus.ACTIVE,
    },
  });
  studentCId = studentC.id;

  // Assign A and B to mentor, C is unassigned
  await prisma.mentorAssignment.createMany({
    data: [
      { mentorId, studentId: studentAId },
      { mentorId, studentId: studentBId },
    ],
  });
});

afterAll(async () => {
  const testUserIds = [mentorId, studentAId, studentBId, studentCId].filter(Boolean);
  if (testUserIds.length > 0) {
    await prisma.riskScore.deleteMany({ where: { studentId: { in: testUserIds } } });
    await prisma.mentorAssignment.deleteMany({ where: { mentorId: { in: testUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  }
  await prisma.role.deleteMany({ where: { name: 'MENTOR_INTEG_TEST' } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  const testStudentIds = [studentAId, studentBId, studentCId].filter(Boolean);
  if (testStudentIds.length > 0) {
    await prisma.riskScore.deleteMany({ where: { studentId: { in: testStudentIds } } });
  }
});

function makeFactors(
  batchId: string | null,
  overrides: Record<string, any> = {},
) {
  return {
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
      totalScore: overrides.totalScore ?? 30,
      riskLevel: overrides.riskLevel ?? 'MEDIUM',
      details: overrides.details ?? {
        attendancePercentage: 80,
        averageAssessmentScore: 60,
        negativeFeedbackPresent: false,
      },
    },
    ml: { status: 'NOT_READY' },
    final: {
      riskLevel: overrides.riskLevel ?? 'MEDIUM',
      decidedBy: 'RULE_ENGINE',
    },
  };
}

const BATCH_X = '00000000-0000-4000-a000-0000000000x1';
const BATCH_Y = '00000000-0000-4000-a000-0000000000y1';

// ---------------------------------------------------------------------------
// 1. HIGH followed by LOW in same week → excluded
// ---------------------------------------------------------------------------
test('student whose latest score is LOW is excluded even if earlier was HIGH', async () => {
  await prisma.riskScore.createMany({
    data: [
      {
        studentId: studentAId,
        attendanceRisk: 30, assessmentRisk: 20, feedbackRisk: 10,
        totalScore: 60, riskLevel: RiskLevel.HIGH,
        factors: makeFactors(BATCH_X, { attendanceRisk: 30, assessmentRisk: 20, feedbackRisk: 10, totalScore: 60, riskLevel: 'HIGH' }),
        generatedAt: new Date('2026-09-29T10:00:00Z'),
      },
      {
        studentId: studentAId,
        attendanceRisk: 0, assessmentRisk: 0, feedbackRisk: 0,
        totalScore: 5, riskLevel: RiskLevel.LOW,
        factors: makeFactors(BATCH_X, { totalScore: 5, riskLevel: 'LOW' }),
        generatedAt: new Date('2026-10-03T10:00:00Z'),
      },
    ],
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  const names = report.students.map((s) => s.name);
  expect(names).not.toContain('Alice Student');
});

// ---------------------------------------------------------------------------
// 2. LOW followed by HIGH in same week → included
// ---------------------------------------------------------------------------
test('student whose latest score is HIGH is included even if earlier was LOW', async () => {
  await prisma.riskScore.createMany({
    data: [
      {
        studentId: studentAId,
        attendanceRisk: 0, assessmentRisk: 0, feedbackRisk: 0,
        totalScore: 5, riskLevel: RiskLevel.LOW,
        factors: makeFactors(BATCH_X, { totalScore: 5, riskLevel: 'LOW' }),
        generatedAt: new Date('2026-09-29T10:00:00Z'),
      },
      {
        studentId: studentAId,
        attendanceRisk: 30, assessmentRisk: 20, feedbackRisk: 10,
        totalScore: 60, riskLevel: RiskLevel.HIGH,
        factors: makeFactors(BATCH_X, { attendanceRisk: 30, assessmentRisk: 20, feedbackRisk: 10, totalScore: 60, riskLevel: 'HIGH' }),
        generatedAt: new Date('2026-10-03T10:00:00Z'),
      },
    ],
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  const names = report.students.map((s) => s.name);
  expect(names).toContain('Alice Student');
  expect(report.students.find((s) => s.name === 'Alice Student')!.riskLevel).toBe('HIGH');
});

// ---------------------------------------------------------------------------
// 3. Stored HIGH with a low numeric rule score remains HIGH
// ---------------------------------------------------------------------------
test('stored HIGH riskLevel is preserved even with low numeric totalScore', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 5, assessmentRisk: 5, feedbackRisk: 5,
      totalScore: 15, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 5, assessmentRisk: 5, feedbackRisk: 5, totalScore: 15, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(1);
  expect(report.students[0].riskLevel).toBe('HIGH');
  expect(report.students[0].riskScore).toBe(15);
});

// ---------------------------------------------------------------------------
// 4. Batch-context-aware comparison — same batch
// ---------------------------------------------------------------------------
test('compares current and previous scores within same batch', async () => {
  // Previous week: score 20 in BATCH_X
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 10, assessmentRisk: 10, feedbackRisk: 0,
      totalScore: 20, riskLevel: RiskLevel.MEDIUM,
      factors: makeFactors(BATCH_X, { attendanceRisk: 10, assessmentRisk: 10, totalScore: 20 }),
      generatedAt: new Date('2026-09-25T10:00:00Z'),
    },
  });
  // Current week: score 50 in BATCH_X (worsening)
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].trend).toBe('↑ Worsening');
});

// ---------------------------------------------------------------------------
// 5. Batch-context-aware comparison — different batch → N/A
// ---------------------------------------------------------------------------
test('shows N/A (different batch) when batch context differs', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 10, assessmentRisk: 10, feedbackRisk: 0,
      totalScore: 20, riskLevel: RiskLevel.MEDIUM,
      factors: makeFactors(BATCH_Y, { attendanceRisk: 10, assessmentRisk: 10, totalScore: 20 }),
      generatedAt: new Date('2026-09-25T10:00:00Z'),
    },
  });
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].trend).toBe('N/A (different batch)');
});

// ---------------------------------------------------------------------------
// 6. Missing previous-week scores → N/A (not treated as LOW)
// ---------------------------------------------------------------------------
test('missing previous-week score gives N/A trend, not LOW', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].trend).toBe('N/A');
});

// ---------------------------------------------------------------------------
// 7. Missing/no-baseline (first ever week) → still returns valid report
// ---------------------------------------------------------------------------
test('first-ever week with no baseline returns students with N/A trend', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentBId,
      attendanceRisk: 30, assessmentRisk: 15, feedbackRisk: 10,
      totalScore: 55, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 30, assessmentRisk: 15, feedbackRisk: 10, totalScore: 55, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-02T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(1);
  expect(report.students[0].name).toBe('Bob Student');
  expect(report.students[0].trend).toBe('N/A');
});

// ---------------------------------------------------------------------------
// 8. Malformed factors — null/empty factors don't crash
// ---------------------------------------------------------------------------
test('score with null factors produces fallback reasons and null dataAvailability', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: null,
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(1);
  expect(report.students[0].reasons).toEqual(['Elevated risk from combined factors']);
  expect(report.students[0].dataAvailability).toBeNull();
  expect(report.students[0].batchId).toBeNull();
});

// ---------------------------------------------------------------------------
// 9. Unknown batch context (factors.scope missing) → null batchId, N/A trend
// ---------------------------------------------------------------------------
test('unknown batch context (no scope in factors) returns null batchId', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: { ruleBased: { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH', details: {} } },
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].batchId).toBeNull();
});

// ---------------------------------------------------------------------------
// 10. Exact period boundaries — score at weekEnd is excluded
// ---------------------------------------------------------------------------
test('score at exact weekEnd boundary is excluded (lt, not lte)', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH' }),
      generatedAt: WEEK_END, // exactly at boundary
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// 11. Score at exact weekStart boundary IS included (gte)
// ---------------------------------------------------------------------------
test('score at exact weekStart boundary is included (gte)', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
      totalScore: 50, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5, totalScore: 50, riskLevel: 'HIGH' }),
      generatedAt: WEEK_START, // exactly at boundary
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(1);
  expect(report.students[0].name).toBe('Alice Student');
});

// ---------------------------------------------------------------------------
// 12. Deterministic tie-breaking — latest generatedAt wins
// ---------------------------------------------------------------------------
test('when multiple scores exist, latest generatedAt is used', async () => {
  await prisma.riskScore.createMany({
    data: [
      {
        studentId: studentAId,
        attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
        totalScore: 50, riskLevel: RiskLevel.HIGH,
        factors: makeFactors(BATCH_X, { totalScore: 50, riskLevel: 'HIGH', attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5 }),
        generatedAt: new Date('2026-10-01T10:00:00Z'),
      },
      {
        studentId: studentAId,
        attendanceRisk: 15, assessmentRisk: 10, feedbackRisk: 5,
        totalScore: 30, riskLevel: RiskLevel.MEDIUM,
        factors: makeFactors(BATCH_X, { totalScore: 30, riskLevel: 'MEDIUM', attendanceRisk: 15, assessmentRisk: 10, feedbackRisk: 5 }),
        generatedAt: new Date('2026-10-03T10:00:00Z'),
      },
    ],
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(1);
  expect(report.students[0].riskScore).toBe(30);
  expect(report.students[0].riskLevel).toBe('MEDIUM');
});

// ---------------------------------------------------------------------------
// 13. Mentor scope — unassigned student C is never included
// ---------------------------------------------------------------------------
test('unassigned student scores are not included in mentor report', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentCId,
      attendanceRisk: 30, assessmentRisk: 25, feedbackRisk: 10,
      totalScore: 65, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, { attendanceRisk: 30, assessmentRisk: 25, feedbackRisk: 10, totalScore: 65, riskLevel: 'HIGH' }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  const names = report.students.map((s) => s.name);
  expect(names).not.toContain('Charlie Student');
});

// ---------------------------------------------------------------------------
// 14. Nonexistent mentor → 404
// ---------------------------------------------------------------------------
test('nonexistent mentor ID throws ServiceError 404', async () => {
  await expect(
    generateWeeklyReportData('00000000-0000-4000-a000-ffffffffffff', WEEK_START, WEEK_END),
  ).rejects.toMatchObject({ statusCode: 404 });
});

// ---------------------------------------------------------------------------
// 15. Empty mentor (no assignments) returns empty students
// ---------------------------------------------------------------------------
test('mentor with no assignments returns empty report', async () => {
  const loner = await prisma.user.create({
    data: {
      name: 'Lonely Mentor',
      email: 'lonely-integ@test.local',
      roleId,
      status: UserStatus.ACTIVE,
    },
  });

  const report = await generateWeeklyReportData(loner.id, WEEK_START, WEEK_END);
  expect(report.students).toEqual([]);
  expect(report.mentorName).toBe('Lonely Mentor');

  await prisma.user.delete({ where: { id: loner.id } });
});

// ---------------------------------------------------------------------------
// 16. Reasons extraction from real DB factors
// ---------------------------------------------------------------------------
test('reasons are correctly extracted from stored factors', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 10,
      totalScore: 55, riskLevel: RiskLevel.HIGH,
      factors: makeFactors(BATCH_X, {
        attendanceRisk: 25,
        assessmentRisk: 20,
        feedbackRisk: 10,
        totalScore: 55,
        riskLevel: 'HIGH',
        details: {
          attendancePercentage: 62.5,
          averageAssessmentScore: 38.0,
          negativeFeedbackPresent: true,
        },
      }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].reasons).toContain('Low attendance: 62.5%');
  expect(report.students[0].reasons).toContain('Low assessment score: 38.0%');
  expect(report.students[0].reasons).toContain('Negative feedback detected');
});

// ---------------------------------------------------------------------------
// 17. JSON batch context CAN be queried in PostgreSQL
// ---------------------------------------------------------------------------
test('PostgreSQL correctly filters by JSON batch context stored in factors', async () => {
  await prisma.riskScore.createMany({
    data: [
      {
        studentId: studentAId,
        attendanceRisk: 25, assessmentRisk: 20, feedbackRisk: 5,
        totalScore: 50, riskLevel: RiskLevel.HIGH,
        factors: makeFactors(BATCH_X),
        generatedAt: new Date('2026-10-01T10:00:00Z'),
      },
      {
        studentId: studentBId,
        attendanceRisk: 20, assessmentRisk: 15, feedbackRisk: 5,
        totalScore: 40, riskLevel: RiskLevel.MEDIUM,
        factors: makeFactors(BATCH_Y),
        generatedAt: new Date('2026-10-02T10:00:00Z'),
      },
    ],
  });

  // Verify JSON operator works in raw query (proving the claim
  // that JSON batch context cannot be queried in DB is false)
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM risk_scores
    WHERE factors->'scope'->>'batchId' = ${BATCH_X}
    AND "generatedAt" >= ${WEEK_START}
    AND "generatedAt" < ${WEEK_END}
  `;
  expect(rows.length).toBe(1);

  // Also verify the service correctly reports both students
  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students).toHaveLength(2);
});

// ---------------------------------------------------------------------------
// 18. Data availability from factors
// ---------------------------------------------------------------------------
test('dataAvailability is correctly read from real DB factors', async () => {
  await prisma.riskScore.create({
    data: {
      studentId: studentAId,
      attendanceRisk: 20, assessmentRisk: 0, feedbackRisk: 10,
      totalScore: 30, riskLevel: RiskLevel.MEDIUM,
      factors: makeFactors(BATCH_X, {
        attendanceRisk: 20,
        feedbackRisk: 10,
        totalScore: 30,
        dataAvailability: { attendance: true, assessment: false, feedback: true },
      }),
      generatedAt: new Date('2026-10-01T10:00:00Z'),
    },
  });

  const report = await generateWeeklyReportData(mentorId, WEEK_START, WEEK_END);
  expect(report.students[0].dataAvailability).toEqual({
    attendance: true,
    assessment: false,
    feedback: true,
  });
});
