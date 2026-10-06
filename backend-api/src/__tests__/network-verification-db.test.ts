const mockDeviceTokenCreate = jest.fn();
const mockDeviceTokenFindUnique = jest.fn();
const mockAttendanceFlagCreate = jest.fn();
const mockAttendanceFlagFindUnique = jest.fn();
const mockAttendanceFlagUpdate = jest.fn();
const mockAttendanceFlagCount = jest.fn();
const mockAttendanceUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    deviceToken: {
      create: (...a: any[]) => mockDeviceTokenCreate(...a),
      findUnique: (...a: any[]) => mockDeviceTokenFindUnique(...a),
    },
    attendanceFlag: {
      create: (...a: any[]) => mockAttendanceFlagCreate(...a),
      findUnique: (...a: any[]) => mockAttendanceFlagFindUnique(...a),
      update: (...a: any[]) => mockAttendanceFlagUpdate(...a),
      count: (...a: any[]) => mockAttendanceFlagCount(...a),
    },
    attendance: {
      update: (...a: any[]) => mockAttendanceUpdate(...a),
    },
    $transaction: (...a: any[]) => mockTransaction(...a),
  },
}));

jest.mock('../lib/redis', () => ({
  __esModule: true,
  default: { set: jest.fn(), get: jest.fn(), sadd: jest.fn(), scard: jest.fn(), sismember: jest.fn(), expire: jest.fn(), exists: jest.fn() },
}));

import {
  resolveDeviceToken,
  createAttendanceFlag,
  resolveFlag,
  getFlagStats,
} from '../services/network-verification.service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveDeviceToken', () => {
  it('creates a new token and returns newRawToken when no cookie exists', async () => {
    mockDeviceTokenCreate.mockResolvedValue({ id: 'dt-new', tokenHash: 'hash', studentId: 'stu-1' });

    const result = await resolveDeviceToken(undefined, 'stu-1', 'Mozilla/5.0');

    expect(mockDeviceTokenCreate).toHaveBeenCalledTimes(1);
    expect(result.deviceTokenId).toBe('dt-new');
    expect(result.flags).toEqual([]);
    expect(result.newRawToken).toBeDefined();
    expect(typeof result.newRawToken).toBe('string');
    expect(result.newRawToken!.length).toBe(64);
  });

  it('returns existing token when cookie matches DB and same student', async () => {
    mockDeviceTokenFindUnique.mockResolvedValue({ id: 'dt-exist', tokenHash: 'h', studentId: 'stu-1' });

    const result = await resolveDeviceToken('raw-cookie-value', 'stu-1', 'Agent');

    expect(mockDeviceTokenCreate).not.toHaveBeenCalled();
    expect(result.deviceTokenId).toBe('dt-exist');
    expect(result.flags).toEqual([]);
    expect(result.newRawToken).toBeUndefined();
  });

  it('flags DEVICE_CONFLICT when cookie matches a different student', async () => {
    mockDeviceTokenFindUnique.mockResolvedValue({ id: 'dt-other', tokenHash: 'h', studentId: 'stu-other' });

    const result = await resolveDeviceToken('raw-value', 'stu-1', 'Agent');

    expect(result.flags).toContain('DEVICE_CONFLICT');
    expect(result.deviceTokenId).toBe('dt-other');
    expect(result.newRawToken).toBeUndefined();
  });

  it('flags DEVICE_RESET and creates new token when cookie not found in DB', async () => {
    mockDeviceTokenFindUnique.mockResolvedValue(null);
    mockDeviceTokenCreate.mockResolvedValue({ id: 'dt-reset', tokenHash: 'h2', studentId: 'stu-1' });

    const result = await resolveDeviceToken('tampered-value', 'stu-1', 'Agent');

    expect(result.flags).toContain('DEVICE_RESET');
    expect(result.deviceTokenId).toBe('dt-reset');
    expect(result.newRawToken).toBeDefined();
    expect(result.newRawToken!.length).toBe(64);
  });

  it('truncates long user-agent strings', async () => {
    mockDeviceTokenCreate.mockResolvedValue({ id: 'dt-1', tokenHash: 'h', studentId: 'stu-1' });
    const longUA = 'x'.repeat(1000);

    await resolveDeviceToken(undefined, 'stu-1', longUA);

    const createArg = mockDeviceTokenCreate.mock.calls[0][0];
    expect(createArg.data.userAgent.length).toBe(512);
  });
});

describe('createAttendanceFlag', () => {
  it('creates a flag with correct data', async () => {
    mockAttendanceFlagCreate.mockResolvedValue({ id: 'flag-1' });

    await createAttendanceFlag('att-1', 'stu-1', 'IP_MISMATCH', 'Trainer: 1.2.3.4, Student: 5.6.7.8');

    expect(mockAttendanceFlagCreate).toHaveBeenCalledWith({
      data: {
        attendanceId: 'att-1',
        studentId: 'stu-1',
        reason: 'IP_MISMATCH',
        details: 'Trainer: 1.2.3.4, Student: 5.6.7.8',
      },
    });
  });
});

describe('resolveFlag', () => {
  it('returns null when flag not found', async () => {
    mockAttendanceFlagFindUnique.mockResolvedValue(null);
    const result = await resolveFlag('missing', 'DISMISSED', 'reviewer-1');
    expect(result).toBeNull();
  });

  it('uses $transaction for CONFIRMED_FRAUD to atomically update flag and attendance', async () => {
    mockAttendanceFlagFindUnique.mockResolvedValue({ id: 'flag-1', attendanceId: 'att-1' });
    const updatedFlag = { id: 'flag-1', status: 'CONFIRMED_FRAUD', student: { id: 'stu-1', name: 'Test', email: 'a@b' } };
    mockTransaction.mockResolvedValue([updatedFlag, { id: 'att-1', status: 'ABSENT' }]);

    const result = await resolveFlag('flag-1', 'CONFIRMED_FRAUD', 'reviewer-1');

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    const txnArgs = mockTransaction.mock.calls[0][0];
    expect(txnArgs).toHaveLength(2);
    expect(result).toEqual(updatedFlag);
  });

  it('does NOT use $transaction for DISMISSED', async () => {
    mockAttendanceFlagFindUnique.mockResolvedValue({ id: 'flag-1', attendanceId: 'att-1' });
    mockAttendanceFlagUpdate.mockResolvedValue({ id: 'flag-1', status: 'DISMISSED' });

    await resolveFlag('flag-1', 'DISMISSED', 'reviewer-1');

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockAttendanceFlagUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'flag-1' },
        data: expect.objectContaining({ status: 'DISMISSED', reviewedBy: 'reviewer-1' }),
      }),
    );
  });
});

describe('getFlagStats', () => {
  it('returns counts for all statuses', async () => {
    mockAttendanceFlagCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(8);

    const stats = await getFlagStats();

    expect(stats).toEqual({ pending: 5, confirmed: 2, dismissed: 8, total: 15 });
    expect(mockAttendanceFlagCount).toHaveBeenCalledTimes(3);
  });
});
