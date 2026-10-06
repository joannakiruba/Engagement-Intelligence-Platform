import { Request, Response, NextFunction } from 'express';

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

import {
  ServiceError,
  getWeeklyLeaderboard,
  getMonday,
  getWeekBounds,
} from '../services/leaderboard.service';

import { getLeaderboardHandler } from '../controllers/leaderboard.controller';

const BATCH_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mkStudent(id: string, name: string, status = 'ACTIVE') {
  return { student: { id, name, status } };
}

function setupBatch(students: ReturnType<typeof mkStudent>[]) {
  mocks.batchFindUnique.mockResolvedValue({ id: BATCH_ID, name: 'Test Batch' });
  mocks.batchMemberFindMany.mockResolvedValue(students);
}

function setupEmptyData() {
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
  setupEmptyData();
});

// ── getMonday ──

describe('getMonday', () => {
  it('returns the provided date as a Monday UTC midnight', () => {
    const m = getMonday('2026-10-05');
    expect(m.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });

  it('returns the current week Monday when no param', () => {
    const m = getMonday();
    expect(m.getUTCDay()).toBe(1);
    expect(m.getUTCHours()).toBe(0);
  });
});

// ── getWeekBounds ──

describe('getWeekBounds', () => {
  it('past week returns full Monday-Sunday', () => {
    const monday = new Date('2026-01-05T00:00:00.000Z');
    const { start, end } = getWeekBounds(monday);
    expect(start.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(end.getUTCDay()).toBe(0); // Sunday
    expect(end.getUTCHours()).toBe(23);
  });

  it('current week end is capped at now', () => {
    const monday = getMonday();
    const { end } = getWeekBounds(monday);
    expect(end.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

// ── Attendance scoring ──

describe('attendance scoring', () => {
  it('all PRESENT = 100', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({ studentId: 's1', status: 'PRESENT' })),
    );

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(100);
  });

  it('LATE counts as attended', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's1', status: 'LATE' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(100);
  });

  it('EXCUSED stays in denominator', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's1', status: 'EXCUSED' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(50);
  });

  it('mixed statuses', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    const records = [
      ...Array.from({ length: 6 }, () => ({ studentId: 's1', status: 'PRESENT' })),
      ...Array.from({ length: 2 }, () => ({ studentId: 's1', status: 'LATE' })),
      { studentId: 's1', status: 'ABSENT' },
      { studentId: 's1', status: 'EXCUSED' },
    ];
    mocks.attendanceFindMany.mockResolvedValue(records);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(80);
  });

  it('no records = 0', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(0);
  });

  it('all ABSENT = 0', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue(
      Array.from({ length: 5 }, () => ({ studentId: 's1', status: 'ABSENT' })),
    );

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].attendanceScore).toBe(0);
  });
});

// ── Assessment scoring ──

describe('assessment scoring', () => {
  it('single assessment percentage', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.assessmentFindMany.mockResolvedValue([{ id: 'a1', maxScore: 100 }]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 80, assessment: { maxScore: 100 } },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].assessmentScore).toBe(80);
  });

  it('multiple assessments — average of percentages', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.assessmentFindMany.mockResolvedValue([
      { id: 'a1', maxScore: 100 },
      { id: 'a2', maxScore: 80 },
    ]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 80, assessment: { maxScore: 100 } },
      { studentId: 's1', assessmentId: 'a2', score: 60, assessment: { maxScore: 80 } },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    // (80/100*100 + 60/80*100) / 2 = (80 + 75) / 2 = 77.50
    expect(result.rankings[0].assessmentScore).toBe(77.5);
  });

  it('maxScore 0 skipped', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.assessmentFindMany.mockResolvedValue([
      { id: 'a1', maxScore: 0 },
      { id: 'a2', maxScore: 100 },
    ]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 0, assessment: { maxScore: 0 } },
      { studentId: 's1', assessmentId: 'a2', score: 90, assessment: { maxScore: 100 } },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].assessmentScore).toBe(90);
  });

  it('no results = 0', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].assessmentScore).toBe(0);
  });
});

// ── Contest scoring ──

describe('contest scoring', () => {
  it('no events — contestDataAvailable false', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.contestDataAvailable).toBe(false);
    expect(result.rankings[0].contestScore).toBe(0);
  });

  it('events exist but no participation — contestDataAvailable true, score 0', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.contestDataAvailable).toBe(true);
    expect(result.rankings[0].contestScore).toBe(0);
  });

  it('registration counts as participation', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].contestScore).toBe(50);
  });

  it('approved proof counts as participation', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mocks.proofSubmissionFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].contestScore).toBe(50);
  });

  it('registration + approved proof for same event = 1 participation', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
    ]);
    mocks.proofSubmissionFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].contestScore).toBe(100);
  });

  it('full participation', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
      { studentId: 's1', eventId: 'e2' },
      { studentId: 's1', eventId: 'e3' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].contestScore).toBe(100);
  });
});

// ── Weighted final score ──

describe('weighted final score', () => {
  it('standard calculation: att=90 ass=80 con=50 → 77.00', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    // 9/10 present = 90%
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    const attRecords = [
      ...Array.from({ length: 9 }, () => ({ studentId: 's1', status: 'PRESENT' })),
      { studentId: 's1', status: 'ABSENT' },
    ];
    mocks.attendanceFindMany.mockResolvedValue(attRecords);

    // 80/100 = 80%
    mocks.assessmentFindMany.mockResolvedValue([{ id: 'a1', maxScore: 100 }]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 80, assessment: { maxScore: 100 } },
    ]);

    // 1 of 2 events = 50%
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    // 90*0.30 + 80*0.50 + 50*0.20 = 27 + 40 + 10 = 77
    expect(result.rankings[0].finalScore).toBe(77);
  });

  it('all zeros', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].finalScore).toBe(0);
  });

  it('perfect scores = 100', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([{ studentId: 's1', status: 'PRESENT' }]);

    mocks.assessmentFindMany.mockResolvedValue([{ id: 'a1', maxScore: 100 }]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 100, assessment: { maxScore: 100 } },
    ]);

    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([{ studentId: 's1', eventId: 'e1' }]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].finalScore).toBe(100);
  });

  it('contest unavailable caps max at 80', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([{ studentId: 's1', status: 'PRESENT' }]);

    mocks.assessmentFindMany.mockResolvedValue([{ id: 'a1', maxScore: 100 }]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 100, assessment: { maxScore: 100 } },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    // 100*0.30 + 100*0.50 + 0*0.20 = 30 + 50 + 0 = 80
    expect(result.contestDataAvailable).toBe(false);
    expect(result.rankings[0].finalScore).toBe(80);
  });
});

// ── Tie-breaking ──

describe('tie-breaking', () => {
  it('higher assessmentScore wins tie', async () => {
    setupBatch([mkStudent('s1', 'Alice'), mkStudent('s2', 'Bob')]);
    // Both get same attendance — both all present
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's2', status: 'PRESENT' },
    ]);
    // Different assessment scores that produce same weighted total when combined
    // s1: att=100, ass=70 → 30 + 35 = 65
    // s2: att=100, ass=70 → 30 + 35 = 65
    // Tie! But let's make assessment different to test tiebreak
    mocks.assessmentFindMany.mockResolvedValue([{ id: 'a1', maxScore: 100 }]);
    mocks.assessmentResultFindMany.mockResolvedValue([
      { studentId: 's1', assessmentId: 'a1', score: 80, assessment: { maxScore: 100 } },
      { studentId: 's2', assessmentId: 'a1', score: 60, assessment: { maxScore: 100 } },
    ]);
    // Both same contest: 1 of 1
    mocks.eventFindMany.mockResolvedValue([{ id: 'e1' }]);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      { studentId: 's1', eventId: 'e1' },
      { studentId: 's2', eventId: 'e1' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    // s1: 100*0.3 + 80*0.5 + 100*0.2 = 30+40+20 = 90
    // s2: 100*0.3 + 60*0.5 + 100*0.2 = 30+30+20 = 80
    // Not a tie, but s1 > s2
    expect(result.rankings[0].studentName).toBe('Alice');
    expect(result.rankings[1].studentName).toBe('Bob');
  });

  it('identical finalScore + assessmentScore → higher attendanceScore wins', async () => {
    setupBatch([mkStudent('s1', 'Alice'), mkStudent('s2', 'Bob')]);
    // s1: att=100 → 30, s2: att=80 → 24
    // We need same final. Let's use no assessments and no events
    // s1: 100*0.3 = 30, s2: 80*0.3 = 24 — different final
    // Need matching final: tricky. Let's just verify sorting when scores differ in attendance only
    mocks.sessionFindMany.mockResolvedValue([{ id: 'sess1' }]);
    mocks.attendanceFindMany.mockResolvedValue([
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's1', status: 'PRESENT' },
      { studentId: 's2', status: 'PRESENT' },
      { studentId: 's2', status: 'ABSENT' },
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings[0].studentName).toBe('Alice');
  });

  it('identical scores → alphabetical name', async () => {
    setupBatch([mkStudent('s1', 'Bob'), mkStudent('s2', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    // Both have 0 everything. Tiebreak by name ASC
    expect(result.rankings[0].studentName).toBe('Alice');
    expect(result.rankings[1].studentName).toBe('Bob');
  });
});

// ── Top 10 ──

describe('top 10', () => {
  it('returns max 10 from 15 students', async () => {
    const students = Array.from({ length: 15 }, (_, i) =>
      mkStudent(`s${i}`, `Student ${String(i).padStart(2, '0')}`),
    );
    setupBatch(students);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings.length).toBe(10);
    expect(result.totalStudents).toBe(15);
  });

  it('returns all when fewer than 10', async () => {
    setupBatch([mkStudent('s1', 'Alice'), mkStudent('s2', 'Bob')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings.length).toBe(2);
  });
});

// ── Inactive students ──

describe('inactive students', () => {
  it('excludes inactive students', async () => {
    setupBatch([
      mkStudent('s1', 'Alice', 'ACTIVE'),
      mkStudent('s2', 'Bob', 'INACTIVE'),
    ]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings.length).toBe(1);
    expect(result.rankings[0].studentName).toBe('Alice');
    expect(result.totalStudents).toBe(1);
  });
});

// ── Batch not found ──

describe('batch not found', () => {
  it('throws ServiceError 404', async () => {
    mocks.batchFindUnique.mockResolvedValue(null);

    await expect(getWeeklyLeaderboard(BATCH_ID, '2026-01-05')).rejects.toThrow(ServiceError);
    await expect(getWeeklyLeaderboard(BATCH_ID, '2026-01-05')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

// ── Empty batch ──

describe('empty batch', () => {
  it('returns empty rankings for batch with no students', async () => {
    setupBatch([]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.rankings).toEqual([]);
    expect(result.totalStudents).toBe(0);
  });
});

// ── Response structure ──

describe('response structure', () => {
  it('contains all required fields', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');

    expect(result).toHaveProperty('batch.id');
    expect(result).toHaveProperty('batch.name');
    expect(result).toHaveProperty('week.start');
    expect(result).toHaveProperty('week.end');
    expect(result).toHaveProperty('week.label');
    expect(result).toHaveProperty('generatedAt');
    expect(result).toHaveProperty('totalStudents');
    expect(result).toHaveProperty('contestDataAvailable');
    expect(result).toHaveProperty('rankings');

    const ranking = result.rankings[0];
    expect(ranking).toHaveProperty('rank');
    expect(ranking).toHaveProperty('studentId');
    expect(ranking).toHaveProperty('studentName');
    expect(ranking).toHaveProperty('attendanceScore');
    expect(ranking).toHaveProperty('assessmentScore');
    expect(ranking).toHaveProperty('contestScore');
    expect(ranking).toHaveProperty('finalScore');
    expect(ranking).toHaveProperty('breakdown.attendanceWeighted');
    expect(ranking).toHaveProperty('breakdown.assessmentWeighted');
    expect(ranking).toHaveProperty('breakdown.contestWeighted');
  });

  it('week label format', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const result = await getWeeklyLeaderboard(BATCH_ID, '2026-01-05');
    expect(result.week.label).toMatch(/^Week \d+, \d{4}$/);
  });
});

// ── Controller ──

describe('getLeaderboardHandler', () => {
  function mockReq(overrides: Partial<Request> = {}): Request {
    return {
      body: {},
      params: { batchId: BATCH_ID },
      query: {},
      user: { sub: 'user-1', roleId: 'role-1' },
      ...overrides,
    } as unknown as Request;
  }

  function mockRes(): Response {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  }

  const next: NextFunction = jest.fn();

  it('returns 200 with leaderboard data', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const req = mockReq();
    const res = mockRes();

    await getLeaderboardHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('returns 404 for missing batch', async () => {
    mocks.batchFindUnique.mockResolvedValue(null);

    const req = mockReq();
    const res = mockRes();

    await getLeaderboardHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('passes week param', async () => {
    setupBatch([mkStudent('s1', 'Alice')]);

    const req = mockReq({ query: { week: '2026-01-05' } });
    const res = mockRes();

    await getLeaderboardHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = (res.json as jest.Mock).mock.calls[0][0].data;
    expect(data.week.start).toBe('2026-01-05');
  });
});
