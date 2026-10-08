import { Request, Response, NextFunction } from 'express';

jest.mock('../services/attendance.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  studentCheckIn: jest.fn(),
  markAttendance: jest.fn(),
  bulkMarkAttendance: jest.fn(),
  updateAttendance: jest.fn(),
  getWindowAttendance: jest.fn(),
  getSessionAttendance: jest.fn(),
  getStudentAttendance: jest.fn(),
  getBatchAttendanceStats: jest.fn(),
  exportSessionAttendanceCsv: jest.fn(),
  generateQRForWindow: jest.fn(),
  createAttendanceWindow: jest.fn(),
  getSessionWindows: jest.fn(),
  getExcusedRecords: jest.fn(),
  isWindowAssignedToMentor: jest.fn(),
  getAssignedAttendanceWindows: jest.fn(),
}));

jest.mock('../services/network-verification.service', () => ({
  extractClientIp: jest.fn().mockReturnValue('203.0.113.10'),
  getFlags: jest.fn(),
  resolveFlag: jest.fn(),
  getFlagStats: jest.fn(),
  getDeviceCookieName: jest.fn().mockReturnValue('eip_device_token'),
  getDeviceCookieMaxAge: jest.fn().mockReturnValue(365 * 24 * 60 * 60 * 1000),
}));

import {
  checkInHandler,
  markAttendanceHandler,
  bulkMarkHandler,
  updateAttendanceHandler,
  getWindowAttendanceHandler,
  getSessionAttendanceHandler,
  getStudentAttendanceHandler,
  getBatchStatsHandler,
  exportCsvHandler,
  generateQRHandler,
  createWindowHandler,
  getExcusedRecordsHandler,
  getSessionWindowsHandler,
  getFlagsHandler,
  resolveFlagHandler,
  getFlagStatsHandler,
} from '../controllers/attendance.controller';

import {
  ServiceError,
  studentCheckIn,
  markAttendance,
  bulkMarkAttendance,
  updateAttendance,
  getWindowAttendance,
  getSessionAttendance,
  getStudentAttendance,
  getBatchAttendanceStats,
  exportSessionAttendanceCsv,
  generateQRForWindow,
  createAttendanceWindow,
  getSessionWindows,
  getExcusedRecords,
} from '../services/attendance.service';

import {
  extractClientIp,
  getFlags,
  resolveFlag,
  getFlagStats,
} from '../services/network-verification.service';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: { 'user-agent': 'TestBrowser/1.0' },
    cookies: {},
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' },
    user: { sub: UUID, roleId: 'role-1', permissions: ['attendance:mark:batch'] },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res as Response;
}

const next: NextFunction = jest.fn();

beforeEach(() => jest.clearAllMocks());

// --- checkInHandler ---

describe('Attendance Controller — checkInHandler', () => {
  it('calls studentCheckIn with network info and device token', async () => {
    (studentCheckIn as jest.Mock).mockResolvedValue({ id: 'att-1', flagged: false, flags: [] });
    const req = mockReq({ body: { windowId: UUID, qrToken: 'abc12345' } });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(studentCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        windowId: UUID,
        studentId: UUID,
        qrToken: 'abc12345',
        networkInfo: expect.objectContaining({ ip: '203.0.113.10' }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('sets device cookie when service returns a new token', async () => {
    (studentCheckIn as jest.Mock).mockResolvedValue({
      id: 'att-1', flagged: false, flags: [], newDeviceToken: 'new-raw-token',
    });
    const req = mockReq({ body: { windowId: UUID, qrToken: 'abc12345' } });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      'eip_device_token',
      'new-raw-token',
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('refreshes cookie from existing value when service returns no new token', async () => {
    (studentCheckIn as jest.Mock).mockResolvedValue({
      id: 'att-1', flagged: false, flags: [],
    });
    const req = mockReq({
      body: { windowId: UUID, qrToken: 'abc12345' },
      cookies: { eip_device_token: 'existing-raw' },
    });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(res.cookie).toHaveBeenCalledWith(
      'eip_device_token',
      'existing-raw',
      expect.objectContaining({ httpOnly: true, path: '/' })
    );
  });

  it('returns service error status on ServiceError', async () => {
    (studentCheckIn as jest.Mock).mockRejectedValue(
      new ServiceError('Window closed', 403)
    );
    const req = mockReq({ body: { windowId: UUID, qrToken: 'token123' } });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Window closed' })
    );
  });

  it('passes unexpected errors to next()', async () => {
    const err = new Error('DB down');
    (studentCheckIn as jest.Mock).mockRejectedValue(err);
    const req = mockReq({ body: { windowId: UUID, qrToken: 'token123' } });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('passes bssid and ssid from body to networkInfo', async () => {
    (studentCheckIn as jest.Mock).mockResolvedValue({ id: 'att-1', flagged: false, flags: [] });
    const req = mockReq({
      body: { windowId: UUID, qrToken: 'abc', bssid: 'AA:BB:CC:DD:EE:FF', ssid: 'CampusWiFi' },
    });
    const res = mockRes();

    await checkInHandler(req, res, next);

    expect(studentCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        networkInfo: expect.objectContaining({
          bssid: 'AA:BB:CC:DD:EE:FF',
          ssid: 'CampusWiFi',
        }),
      })
    );
  });
});

// --- markAttendanceHandler ---

describe('Attendance Controller — markAttendanceHandler', () => {
  it('calls markAttendance with correct args and returns 201', async () => {
    (markAttendance as jest.Mock).mockResolvedValue({ id: 'att-2', status: 'PRESENT' });
    const req = mockReq({
      body: { windowId: UUID, studentId: UUID2, status: 'PRESENT', remarks: 'On time' },
    });
    const res = mockRes();

    await markAttendanceHandler(req, res, next);

    expect(markAttendance).toHaveBeenCalledWith(UUID, UUID2, 'PRESENT', 'On time');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('handles missing optional remarks', async () => {
    (markAttendance as jest.Mock).mockResolvedValue({ id: 'att-3' });
    const req = mockReq({
      body: { windowId: UUID, studentId: UUID2, status: 'ABSENT' },
    });
    const res = mockRes();

    await markAttendanceHandler(req, res, next);

    expect(markAttendance).toHaveBeenCalledWith(UUID, UUID2, 'ABSENT', undefined);
  });
});

// --- bulkMarkHandler ---

describe('Attendance Controller — bulkMarkHandler', () => {
  it('calls bulkMarkAttendance and returns 200', async () => {
    const records = [
      { studentId: UUID, status: 'PRESENT' },
      { studentId: UUID2, status: 'LATE' },
    ];
    (bulkMarkAttendance as jest.Mock).mockResolvedValue({ created: 2, skipped: 0 });
    const req = mockReq({ body: { windowId: UUID, records } });
    const res = mockRes();

    await bulkMarkHandler(req, res, next);

    expect(bulkMarkAttendance).toHaveBeenCalledWith(UUID, records);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('propagates ServiceError for invalid window', async () => {
    (bulkMarkAttendance as jest.Mock).mockRejectedValue(
      new ServiceError('Window not found', 404)
    );
    const req = mockReq({ body: { windowId: UUID, records: [] } });
    const res = mockRes();

    await bulkMarkHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// --- updateAttendanceHandler ---

describe('Attendance Controller — updateAttendanceHandler', () => {
  it('passes id from params and body to updateAttendance', async () => {
    (updateAttendance as jest.Mock).mockResolvedValue({ id: UUID, status: 'EXCUSED' });
    const req = mockReq({ params: { id: UUID }, body: { status: 'EXCUSED' } });
    const res = mockRes();

    await updateAttendanceHandler(req, res, next);

    expect(updateAttendance).toHaveBeenCalledWith(UUID, { status: 'EXCUSED' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// --- getWindowAttendanceHandler ---

describe('Attendance Controller — getWindowAttendanceHandler', () => {
  it('fetches attendance for a specific window', async () => {
    (getWindowAttendance as jest.Mock).mockResolvedValue([{ id: 'att-1' }]);
    const req = mockReq({ params: { windowId: UUID } });
    const res = mockRes();

    await getWindowAttendanceHandler(req, res, next);

    expect(getWindowAttendance).toHaveBeenCalledWith(UUID);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ id: 'att-1' }] })
    );
  });
});

// --- getSessionAttendanceHandler ---

describe('Attendance Controller — getSessionAttendanceHandler', () => {
  it('fetches attendance for a session', async () => {
    (getSessionAttendance as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ params: { sessionId: UUID } });
    const res = mockRes();

    await getSessionAttendanceHandler(req, res, next);

    expect(getSessionAttendance).toHaveBeenCalledWith(UUID);
  });
});

// --- getStudentAttendanceHandler ---

describe('Attendance Controller — getStudentAttendanceHandler', () => {
  it('passes query filters to getStudentAttendance', async () => {
    (getStudentAttendance as jest.Mock).mockResolvedValue([]);
    const req = mockReq({
      params: { studentId: UUID },
      query: { batchId: UUID2, from: '2026-01-01', to: '2026-12-31' },
    });
    const res = mockRes();

    await getStudentAttendanceHandler(req, res, next);

    expect(getStudentAttendance).toHaveBeenCalledWith(UUID, {
      batchId: UUID2,
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('passes empty filters when no query params', async () => {
    (getStudentAttendance as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ params: { studentId: UUID } });
    const res = mockRes();

    await getStudentAttendanceHandler(req, res, next);

    expect(getStudentAttendance).toHaveBeenCalledWith(UUID, {});
  });
});

// --- getBatchStatsHandler ---

describe('Attendance Controller — getBatchStatsHandler', () => {
  it('fetches batch stats', async () => {
    (getBatchAttendanceStats as jest.Mock).mockResolvedValue({ total: 50, present: 45 });
    const req = mockReq({ params: { batchId: UUID } });
    const res = mockRes();

    await getBatchStatsHandler(req, res, next);

    expect(getBatchAttendanceStats).toHaveBeenCalledWith(UUID);
  });
});

// --- exportCsvHandler ---

describe('Attendance Controller — exportCsvHandler', () => {
  it('sets CSV headers and sends content', async () => {
    (exportSessionAttendanceCsv as jest.Mock).mockResolvedValue('name,status\nJohn,PRESENT');
    const req = mockReq({ params: { sessionId: UUID } });
    const res = mockRes();

    await exportCsvHandler(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="attendance-${UUID}.csv"`
    );
    expect(res.send).toHaveBeenCalledWith('name,status\nJohn,PRESENT');
  });
});

// --- generateQRHandler ---

describe('Attendance Controller — generateQRHandler', () => {
  it('returns QR data and passes trainer IP', async () => {
    (generateQRForWindow as jest.Mock).mockResolvedValue({ token: 'abc12345', expiresInSeconds: 30 });
    const req = mockReq({ params: { windowId: UUID } });
    const res = mockRes();

    await generateQRHandler(req, res, next);

    expect(extractClientIp).toHaveBeenCalledWith(req);
    expect(generateQRForWindow).toHaveBeenCalledWith(UUID, '203.0.113.10');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { token: 'abc12345', expiresInSeconds: 30 } })
    );
  });
});

// --- createWindowHandler ---

describe('Attendance Controller — createWindowHandler', () => {
  it('passes parsed times to createAttendanceWindow', async () => {
    (createAttendanceWindow as jest.Mock).mockResolvedValue({ id: 'win-1' });
    const req = mockReq({
      body: {
        sessionId: UUID,
        label: 'Morning',
        startTime: '2026-09-25T07:50:00.000Z',
        endTime: '2026-09-25T08:05:00.000Z',
      },
    });
    const res = mockRes();

    await createWindowHandler(req, res, next);

    expect(createAttendanceWindow).toHaveBeenCalledWith(
      UUID,
      'Morning',
      new Date('2026-09-25T07:50:00.000Z'),
      new Date('2026-09-25T08:05:00.000Z')
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('uses default 7:50-8:05 times when not provided', async () => {
    (createAttendanceWindow as jest.Mock).mockResolvedValue({ id: 'win-2' });
    const req = mockReq({ body: { sessionId: UUID, label: 'Default' } });
    const res = mockRes();

    await createWindowHandler(req, res, next);

    const call = (createAttendanceWindow as jest.Mock).mock.calls[0];
    const startTime: Date = call[2];
    const endTime: Date = call[3];
    expect(startTime.getHours()).toBe(7);
    expect(startTime.getMinutes()).toBe(50);
    expect(endTime.getHours()).toBe(8);
    expect(endTime.getMinutes()).toBe(5);
  });
});

// --- getExcusedRecordsHandler ---

describe('Attendance Controller — getExcusedRecordsHandler', () => {
  it('passes filter query params', async () => {
    (getExcusedRecords as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ query: { batchId: UUID, sessionId: UUID2 } });
    const res = mockRes();

    await getExcusedRecordsHandler(req, res, next);

    expect(getExcusedRecords).toHaveBeenCalledWith({ batchId: UUID, sessionId: UUID2 });
  });
});

// --- getSessionWindowsHandler ---

describe('Attendance Controller — getSessionWindowsHandler', () => {
  it('returns windows for a session', async () => {
    (getSessionWindows as jest.Mock).mockResolvedValue([{ id: 'win-1', label: 'AM' }]);
    const req = mockReq({ params: { sessionId: UUID } });
    const res = mockRes();

    await getSessionWindowsHandler(req, res, next);

    expect(getSessionWindows).toHaveBeenCalledWith(UUID);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ id: 'win-1', label: 'AM' }] })
    );
  });
});

// --- Flag management handlers ---

describe('Attendance Controller — getFlagsHandler', () => {
  it('passes query filters to getFlags', async () => {
    (getFlags as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ query: { status: 'PENDING', batchId: UUID } });
    const res = mockRes();

    await getFlagsHandler(req, res, next);

    expect(getFlags).toHaveBeenCalledWith({ status: 'PENDING', batchId: UUID });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes empty filters when no query params', async () => {
    (getFlags as jest.Mock).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();

    await getFlagsHandler(req, res, next);

    expect(getFlags).toHaveBeenCalledWith({});
  });
});

describe('Attendance Controller — resolveFlagHandler', () => {
  it('resolves a flag as CONFIRMED_FRAUD', async () => {
    (resolveFlag as jest.Mock).mockResolvedValue({ id: 'flag-1', status: 'CONFIRMED_FRAUD' });
    const req = mockReq({ params: { id: 'flag-1' }, body: { status: 'CONFIRMED_FRAUD' } });
    const res = mockRes();

    await resolveFlagHandler(req, res, next);

    expect(resolveFlag).toHaveBeenCalledWith('flag-1', 'CONFIRMED_FRAUD', UUID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('resolves a flag as DISMISSED', async () => {
    (resolveFlag as jest.Mock).mockResolvedValue({ id: 'flag-1', status: 'DISMISSED' });
    const req = mockReq({ params: { id: 'flag-1' }, body: { status: 'DISMISSED' } });
    const res = mockRes();

    await resolveFlagHandler(req, res, next);

    expect(resolveFlag).toHaveBeenCalledWith('flag-1', 'DISMISSED', UUID);
  });

  it('returns 404 when flag not found', async () => {
    (resolveFlag as jest.Mock).mockResolvedValue(null);
    const req = mockReq({ params: { id: 'missing' }, body: { status: 'DISMISSED' } });
    const res = mockRes();

    await resolveFlagHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Flag not found' })
    );
  });
});

describe('Attendance Controller — getFlagStatsHandler', () => {
  it('returns flag stats', async () => {
    (getFlagStats as jest.Mock).mockResolvedValue({ pending: 3, confirmed: 1, dismissed: 5, total: 9 });
    const req = mockReq();
    const res = mockRes();

    await getFlagStatsHandler(req, res, next);

    expect(getFlagStats).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { pending: 3, confirmed: 1, dismissed: 5, total: 9 } })
    );
  });
});
