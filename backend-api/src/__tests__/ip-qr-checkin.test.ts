/**
 * Comprehensive IP/QR check-in behaviour tests.
 *
 * Tests the full studentCheckIn flow through its 5 gates:
 *   1. Redis dedup  2. QR validation  3. Device token  4. Window time  5. Batch membership
 * Plus network-match flagging and admin flag resolution.
 */

// ── Prisma mock ────────────────────────────────────────────────────────────
const mockAttendanceFindUnique = jest.fn();
const mockAttendanceUpdate = jest.fn();
const mockAttendanceCreate = jest.fn();
const mockWindowFindUnique = jest.fn();
const mockDeviceTokenCreate = jest.fn();
const mockDeviceTokenFindUnique = jest.fn();
const mockFlagCreate = jest.fn();
const mockFlagFindUnique = jest.fn();
const mockFlagUpdate = jest.fn();
const mockFlagCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    attendance: {
      findUnique: (...a: any[]) => mockAttendanceFindUnique(...a),
      update: (...a: any[]) => mockAttendanceUpdate(...a),
      create: (...a: any[]) => mockAttendanceCreate(...a),
      createMany: jest.fn(),
    },
    attendanceWindow: {
      findUnique: (...a: any[]) => mockWindowFindUnique(...a),
    },
    attendanceFlag: {
      create: (...a: any[]) => mockFlagCreate(...a),
      findUnique: (...a: any[]) => mockFlagFindUnique(...a),
      update: (...a: any[]) => mockFlagUpdate(...a),
      count: (...a: any[]) => mockFlagCount(...a),
    },
    deviceToken: {
      create: (...a: any[]) => mockDeviceTokenCreate(...a),
      findUnique: (...a: any[]) => mockDeviceTokenFindUnique(...a),
    },
    session: { findUnique: jest.fn() },
    $transaction: (...a: any[]) => mockTransaction(...a),
  },
}));

// ── Redis mock ─────────────────────────────────────────────────────────────
jest.mock('../lib/redis', () => ({
  __esModule: true,
  default: {
    set: jest.fn(),
    get: jest.fn(),
    sadd: jest.fn(),
    scard: jest.fn(),
    sismember: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
  },
}));
import redis from '../lib/redis';
const mockRedis = redis as jest.Mocked<typeof redis>;

// ── Imports (after mocks) ──────────────────────────────────────────────────
import { studentCheckIn, generateQRToken, ServiceError } from '../services/attendance.service';
import { resolveFlag } from '../services/network-verification.service';

// ── Helpers ────────────────────────────────────────────────────────────────
const WINDOW_ID = 'win-1';
const SESSION_ID = 'sess-1';
const STUDENT_ID = 'stu-1';
const BATCH_ID = 'batch-1';

function validQRToken(): string {
  return generateQRToken(WINDOW_ID).token;
}

const now = new Date('2026-10-06T10:30:00Z');

function makeWindow(overrides?: Partial<{
  startTime: Date;
  endTime: Date;
  trainerIp: string | null;
  networkFingerprint: string | null;
}>) {
  return {
    id: WINDOW_ID,
    sessionId: SESSION_ID,
    startTime: overrides?.startTime ?? new Date('2026-10-06T10:00:00Z'),
    endTime: overrides?.endTime ?? new Date('2026-10-06T11:00:00Z'),
    trainerIp: 'trainerIp' in (overrides || {}) ? overrides!.trainerIp : '10.0.0.1',
    networkFingerprint: 'networkFingerprint' in (overrides || {}) ? overrides!.networkFingerprint : '10.0.0.1',
    session: {
      batchId: BATCH_ID,
      batch: {
        members: [{ studentId: STUDENT_ID }, { studentId: 'stu-2' }],
      },
    },
  };
}

function baseOpts(overrides?: Partial<Parameters<typeof studentCheckIn>[0]>) {
  return {
    windowId: WINDOW_ID,
    studentId: STUDENT_ID,
    qrToken: validQRToken(),
    networkInfo: { ip: '10.0.0.1' },
    deviceTokenRaw: undefined,
    userAgent: 'TestAgent/1.0',
    ...overrides,
  };
}

const attendanceRecord = {
  id: 'att-1',
  windowId: WINDOW_ID,
  sessionId: SESSION_ID,
  studentId: STUDENT_ID,
  status: 'PRESENT',
  checkInTime: now,
  student: { id: STUDENT_ID, name: 'Alice', email: 'alice@test.com' },
  session: { id: SESSION_ID, title: 'Session 1' },
};

// ── Setup ──────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(now);

  // Default: Redis cache miss (forces DB path)
  mockRedis.sismember.mockResolvedValue(0);
  mockRedis.get.mockResolvedValue(null);
  mockRedis.exists.mockResolvedValue(0);
  mockRedis.set.mockResolvedValue('OK');
  mockRedis.sadd.mockResolvedValue(1);
  mockRedis.expire.mockResolvedValue(1);

  // Default: window exists, is open, student is enrolled
  mockWindowFindUnique.mockResolvedValue(makeWindow());

  // Default: no existing device token → new one created
  mockDeviceTokenFindUnique.mockResolvedValue(null);
  mockDeviceTokenCreate.mockResolvedValue({ id: 'dt-1', tokenHash: 'h', studentId: STUDENT_ID });

  // Default: no prior attendance record → create new
  mockAttendanceFindUnique.mockResolvedValue(null);
  mockAttendanceCreate.mockResolvedValue(attendanceRecord);
  mockAttendanceUpdate.mockResolvedValue(attendanceRecord);

  // Default: flag creation succeeds
  mockFlagCreate.mockResolvedValue({ id: 'flag-1' });
});

afterEach(() => {
  jest.useRealTimers();
});

// ── 1. Valid check-in ──────────────────────────────────────────────────────
describe('1 — Valid check-in (happy path)', () => {
  it('succeeds with matching IP and returns attendance record', async () => {
    const result = await studentCheckIn(baseOpts());

    expect(result.status).toBe('PRESENT');
    expect(result.studentId).toBe(STUDENT_ID);
    expect(result.flagged).toBe(false);
    expect(result.flags).toEqual([]);
  });

  it('caches check-in in Redis after success', async () => {
    await studentCheckIn(baseOpts());

    expect(mockRedis.sadd).toHaveBeenCalledWith(
      expect.stringContaining('checkins:'),
      STUDENT_ID
    );
  });

  it('returns newDeviceToken when no cookie was provided', async () => {
    const result = await studentCheckIn(baseOpts({ deviceTokenRaw: undefined }));

    expect(result.newDeviceToken).toBeDefined();
    expect(typeof result.newDeviceToken).toBe('string');
  });
});

// ── 2. Expired / missing QR ───────────────────────────────────────────────
describe('2 — Expired or missing QR token', () => {
  it('rejects an invalid QR token with 400', async () => {
    await expect(
      studentCheckIn(baseOpts({ qrToken: 'deadbeef' }))
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('Invalid or expired QR'),
      statusCode: 400,
    }));
  });

  it('rejects an empty QR token', async () => {
    await expect(
      studentCheckIn(baseOpts({ qrToken: '' }))
    ).rejects.toThrow(expect.objectContaining({
      statusCode: 400,
    }));
  });
});

// ── 3. Closed attendance window ────────────────────────────────────────────
describe('3 — Closed attendance window', () => {
  it('rejects check-in after window has closed', async () => {
    mockWindowFindUnique.mockResolvedValue(
      makeWindow({
        startTime: new Date('2026-10-06T08:00:00Z'),
        endTime: new Date('2026-10-06T09:00:00Z'),
      })
    );

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('Check-in closed'),
      statusCode: 403,
    }));
  });

  it('rejects check-in before window has opened', async () => {
    mockWindowFindUnique.mockResolvedValue(
      makeWindow({
        startTime: new Date('2026-10-06T12:00:00Z'),
        endTime: new Date('2026-10-06T13:00:00Z'),
      })
    );

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      statusCode: 403,
    }));
  });
});

// ── 4. Wrong batch ─────────────────────────────────────────────────────────
describe('4 — Student not enrolled in batch', () => {
  it('rejects check-in for a student not in the batch', async () => {
    const win = makeWindow();
    win.session.batch.members = [{ studentId: 'stu-other' }];
    mockWindowFindUnique.mockResolvedValue(win);

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('not enrolled'),
      statusCode: 403,
    }));
  });

  it('rejects via Redis cache when batch membership is cached as false', async () => {
    // Simulate Redis cache hit for window metadata
    mockRedis.get.mockImplementation((key: string) => {
      if (key === `window:${WINDOW_ID}`) {
        return JSON.stringify({
          sessionId: SESSION_ID,
          startTime: '2026-10-06T10:00:00Z',
          endTime: '2026-10-06T11:00:00Z',
          batchId: BATCH_ID,
        });
      }
      return null;
    });
    // Batch members cache exists but student is not a member
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.sismember.mockImplementation((_key: string, member: string) => {
      return member === STUDENT_ID ? 0 : 1;
    });

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('not enrolled'),
      statusCode: 403,
    }));

    // Should NOT have hit the database for window lookup
    expect(mockWindowFindUnique).not.toHaveBeenCalled();
  });
});

// ── 5. Duplicate check-in ──────────────────────────────────────────────────
describe('5 — Duplicate check-in', () => {
  it('rejects via Redis fast-path when already checked in', async () => {
    mockRedis.sismember.mockResolvedValue(1);

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('already recorded'),
      statusCode: 409,
    }));

    // Should not even validate QR when Redis says already checked in
    expect(mockWindowFindUnique).not.toHaveBeenCalled();
  });

  it('rejects via DB when attendance record exists as PRESENT', async () => {
    mockAttendanceFindUnique.mockResolvedValue({
      ...attendanceRecord,
      status: 'PRESENT',
    });

    await expect(
      studentCheckIn(baseOpts())
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('already recorded'),
      statusCode: 409,
    }));
  });
});

// ── 6. IP mismatch ─────────────────────────────────────────────────────────
describe('6 — IP mismatch between trainer and student', () => {
  it('succeeds but flags IP_MISMATCH when IPs differ', async () => {
    mockWindowFindUnique.mockResolvedValue(
      makeWindow({ trainerIp: '10.0.0.1', networkFingerprint: '10.0.0.1' })
    );

    const result = await studentCheckIn(
      baseOpts({ networkInfo: { ip: '192.168.1.50' } })
    );

    expect(result.status).toBe('PRESENT');
    expect(result.flagged).toBe(true);
    expect(result.flags).toContain('IP_MISMATCH');

    expect(mockFlagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'IP_MISMATCH',
          details: expect.stringContaining('10.0.0.1'),
        }),
      })
    );
  });

  it('does not flag when trainer has no recorded IP', async () => {
    mockWindowFindUnique.mockResolvedValue(
      makeWindow({ trainerIp: null, networkFingerprint: null })
    );

    const result = await studentCheckIn(
      baseOpts({ networkInfo: { ip: '192.168.1.50' } })
    );

    expect(result.flagged).toBe(false);
    expect(result.flags).not.toContain('IP_MISMATCH');
  });
});

// ── 7. Browser account conflict (DEVICE_CONFLICT) ─────────────────────────
describe('7 — Browser account conflict (device registered to another student)', () => {
  it('rejects check-in with 403 when device belongs to different student', async () => {
    // Cookie maps to a device token owned by another student
    mockDeviceTokenFindUnique.mockResolvedValue({
      id: 'dt-other',
      tokenHash: 'h',
      studentId: 'stu-other',
    });

    await expect(
      studentCheckIn(baseOpts({ deviceTokenRaw: 'some-existing-cookie' }))
    ).rejects.toThrow(expect.objectContaining({
      message: expect.stringContaining('registered to another student'),
      statusCode: 403,
    }));
  });

  it('does not create any attendance record on DEVICE_CONFLICT', async () => {
    mockDeviceTokenFindUnique.mockResolvedValue({
      id: 'dt-other',
      tokenHash: 'h',
      studentId: 'stu-other',
    });

    await expect(
      studentCheckIn(baseOpts({ deviceTokenRaw: 'some-existing-cookie' }))
    ).rejects.toThrow();

    expect(mockAttendanceCreate).not.toHaveBeenCalled();
    expect(mockAttendanceUpdate).not.toHaveBeenCalled();
  });
});

// ── 8. Device token reset ──────────────────────────────────────────────────
describe('8 — Device token reset (tampered or unrecognized cookie)', () => {
  it('succeeds but flags DEVICE_RESET when cookie is not found in DB', async () => {
    // Cookie provided but not found → resolveDeviceToken flags DEVICE_RESET
    mockDeviceTokenFindUnique.mockResolvedValue(null);
    mockDeviceTokenCreate.mockResolvedValue({
      id: 'dt-new',
      tokenHash: 'hnew',
      studentId: STUDENT_ID,
    });

    const result = await studentCheckIn(
      baseOpts({ deviceTokenRaw: 'tampered-cookie-value' })
    );

    expect(result.status).toBe('PRESENT');
    expect(result.flagged).toBe(true);
    expect(result.flags).toContain('DEVICE_RESET');
    expect(result.newDeviceToken).toBeDefined();
  });

  it('creates an attendance flag record for DEVICE_RESET', async () => {
    mockDeviceTokenFindUnique.mockResolvedValue(null);
    mockDeviceTokenCreate.mockResolvedValue({
      id: 'dt-new',
      tokenHash: 'hnew',
      studentId: STUDENT_ID,
    });

    await studentCheckIn(baseOpts({ deviceTokenRaw: 'tampered-value' }));

    expect(mockFlagCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'DEVICE_RESET',
          studentId: STUDENT_ID,
        }),
      })
    );
  });
});

// ── 9. Admin flag resolution ───────────────────────────────────────────────
describe('9 — Admin flag resolution', () => {
  it('CONFIRMED_FRAUD atomically marks attendance as ABSENT', async () => {
    mockFlagFindUnique.mockResolvedValue({
      id: 'flag-1',
      attendanceId: 'att-1',
    });
    const updatedFlag = {
      id: 'flag-1',
      status: 'CONFIRMED_FRAUD',
      student: { id: STUDENT_ID, name: 'Alice', email: 'alice@test.com' },
    };
    mockTransaction.mockResolvedValue([
      updatedFlag,
      { id: 'att-1', status: 'ABSENT' },
    ]);

    const result = await resolveFlag('flag-1', 'CONFIRMED_FRAUD', 'admin-1');

    expect(result).toEqual(updatedFlag);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txnArgs = mockTransaction.mock.calls[0][0];
    expect(txnArgs).toHaveLength(2);
  });

  it('DISMISSED updates flag without touching attendance record', async () => {
    mockFlagFindUnique.mockResolvedValue({
      id: 'flag-1',
      attendanceId: 'att-1',
    });
    mockFlagUpdate.mockResolvedValue({
      id: 'flag-1',
      status: 'DISMISSED',
      student: { id: STUDENT_ID, name: 'Alice', email: 'alice@test.com' },
    });

    await resolveFlag('flag-1', 'DISMISSED', 'admin-1');

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockFlagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'flag-1' },
        data: expect.objectContaining({
          status: 'DISMISSED',
          reviewedBy: 'admin-1',
        }),
      })
    );
  });

  it('returns null for a non-existent flag', async () => {
    mockFlagFindUnique.mockResolvedValue(null);

    const result = await resolveFlag('nonexistent', 'DISMISSED', 'admin-1');
    expect(result).toBeNull();
  });
});

// ── Edge: combined flags ───────────────────────────────────────────────────
describe('Combined flags — IP mismatch + device reset on single check-in', () => {
  it('flags both IP_MISMATCH and DEVICE_RESET simultaneously', async () => {
    // Mismatched IP
    mockWindowFindUnique.mockResolvedValue(
      makeWindow({ trainerIp: '10.0.0.1', networkFingerprint: '10.0.0.1' })
    );

    // Tampered cookie → DEVICE_RESET
    mockDeviceTokenFindUnique.mockResolvedValue(null);
    mockDeviceTokenCreate.mockResolvedValue({
      id: 'dt-new',
      tokenHash: 'h',
      studentId: STUDENT_ID,
    });

    const result = await studentCheckIn(
      baseOpts({
        networkInfo: { ip: '192.168.1.50' },
        deviceTokenRaw: 'tampered',
      })
    );

    expect(result.flagged).toBe(true);
    expect(result.flags).toContain('IP_MISMATCH');
    expect(result.flags).toContain('DEVICE_RESET');
    expect(mockFlagCreate).toHaveBeenCalledTimes(2);
  });
});
