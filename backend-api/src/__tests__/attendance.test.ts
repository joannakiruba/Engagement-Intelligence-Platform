import {
  checkInSchema,
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  createWindowSchema,
} from '../validators/attendance.validator';

function isValid(schema: any, data: any): boolean {
  const { error } = schema.validate(data, { abortEarly: false });
  return !error;
}

function getErrors(schema: any, data: any): string {
  const { error } = schema.validate(data, { abortEarly: false });
  return error ? error.details.map((d: any) => d.message).join(' ') : '';
}

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_UUID_2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

describe('Attendance Validators', () => {
  describe('checkInSchema', () => {
    it('should accept valid check-in with windowId only', () => {
      expect(isValid(checkInSchema, { windowId: VALID_UUID })).toBe(true);
    });

    it('should accept valid check-in with QR token', () => {
      expect(isValid(checkInSchema, { windowId: VALID_UUID, qrToken: 'abc12345' })).toBe(true);
    });

    it('should reject missing windowId', () => {
      expect(isValid(checkInSchema, {})).toBe(false);
    });

    it('should reject invalid windowId', () => {
      expect(isValid(checkInSchema, { windowId: 'not-a-uuid' })).toBe(false);
      expect(getErrors(checkInSchema, { windowId: 'not-a-uuid' })).toContain('UUID');
    });

    it('should reject empty QR token when provided', () => {
      expect(isValid(checkInSchema, { windowId: VALID_UUID, qrToken: '' })).toBe(false);
    });

    it('should strip unknown fields', () => {
      const { value } = checkInSchema.validate(
        { windowId: VALID_UUID, hackField: 'inject' },
        { stripUnknown: true }
      );
      expect(value.hackField).toBeUndefined();
    });
  });

  describe('markAttendanceSchema', () => {
    const validData = {
      windowId: VALID_UUID,
      studentId: VALID_UUID_2,
      status: 'PRESENT',
    };

    it('should accept valid mark attendance', () => {
      expect(isValid(markAttendanceSchema, validData)).toBe(true);
    });

    it('should accept with optional remarks', () => {
      expect(isValid(markAttendanceSchema, { ...validData, remarks: 'On time' })).toBe(true);
    });

    it('should accept all valid statuses', () => {
      for (const status of ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) {
        expect(isValid(markAttendanceSchema, { ...validData, status })).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      expect(isValid(markAttendanceSchema, { ...validData, status: 'INVALID' })).toBe(false);
      expect(getErrors(markAttendanceSchema, { ...validData, status: 'INVALID' })).toContain(
        'PRESENT, ABSENT, LATE, EXCUSED'
      );
    });

    it('should reject missing windowId', () => {
      const { windowId, ...rest } = validData;
      expect(isValid(markAttendanceSchema, rest)).toBe(false);
    });

    it('should reject missing studentId', () => {
      const { studentId, ...rest } = validData;
      expect(isValid(markAttendanceSchema, rest)).toBe(false);
    });

    it('should reject missing status', () => {
      const { status, ...rest } = validData;
      expect(isValid(markAttendanceSchema, rest)).toBe(false);
    });

    it('should reject invalid UUIDs', () => {
      expect(isValid(markAttendanceSchema, { ...validData, windowId: 'bad' })).toBe(false);
      expect(isValid(markAttendanceSchema, { ...validData, studentId: 'bad' })).toBe(false);
    });

    it('should reject remarks exceeding 500 characters', () => {
      expect(isValid(markAttendanceSchema, { ...validData, remarks: 'x'.repeat(501) })).toBe(false);
    });

    it('should accept remarks at exactly 500 characters', () => {
      expect(isValid(markAttendanceSchema, { ...validData, remarks: 'x'.repeat(500) })).toBe(true);
    });
  });

  describe('bulkMarkAttendanceSchema', () => {
    const validData = {
      windowId: VALID_UUID,
      records: [
        { studentId: VALID_UUID_2, status: 'PRESENT' },
        { studentId: VALID_UUID, status: 'ABSENT', remarks: 'No show' },
      ],
    };

    it('should accept valid bulk mark', () => {
      expect(isValid(bulkMarkAttendanceSchema, validData)).toBe(true);
    });

    it('should accept single record', () => {
      expect(
        isValid(bulkMarkAttendanceSchema, {
          windowId: VALID_UUID,
          records: [{ studentId: VALID_UUID_2, status: 'LATE' }],
        })
      ).toBe(true);
    });

    it('should reject empty records array', () => {
      expect(isValid(bulkMarkAttendanceSchema, { windowId: VALID_UUID, records: [] })).toBe(false);
      expect(getErrors(bulkMarkAttendanceSchema, { windowId: VALID_UUID, records: [] })).toContain(
        'At least'
      );
    });

    it('should reject missing records', () => {
      expect(isValid(bulkMarkAttendanceSchema, { windowId: VALID_UUID })).toBe(false);
    });

    it('should reject record with invalid studentId', () => {
      expect(
        isValid(bulkMarkAttendanceSchema, {
          windowId: VALID_UUID,
          records: [{ studentId: 'bad-id', status: 'PRESENT' }],
        })
      ).toBe(false);
    });

    it('should reject record with invalid status', () => {
      expect(
        isValid(bulkMarkAttendanceSchema, {
          windowId: VALID_UUID,
          records: [{ studentId: VALID_UUID_2, status: 'UNKNOWN' }],
        })
      ).toBe(false);
    });

    it('should reject missing windowId', () => {
      expect(isValid(bulkMarkAttendanceSchema, { records: validData.records })).toBe(false);
    });
  });

  describe('updateAttendanceSchema', () => {
    it('should accept status update only', () => {
      expect(isValid(updateAttendanceSchema, { status: 'PRESENT' })).toBe(true);
    });

    it('should accept remarks update only', () => {
      expect(isValid(updateAttendanceSchema, { remarks: 'Bus was late' })).toBe(true);
    });

    it('should accept both status and remarks', () => {
      expect(isValid(updateAttendanceSchema, { status: 'EXCUSED', remarks: 'Medical leave' })).toBe(true);
    });

    it('should accept empty object (no fields to update)', () => {
      expect(isValid(updateAttendanceSchema, {})).toBe(true);
    });

    it('should reject invalid status', () => {
      expect(isValid(updateAttendanceSchema, { status: 'INVALID' })).toBe(false);
    });

    it('should reject remarks exceeding 500 characters', () => {
      expect(isValid(updateAttendanceSchema, { remarks: 'x'.repeat(501) })).toBe(false);
    });
  });

  describe('createWindowSchema', () => {
    const validData = {
      sessionId: VALID_UUID,
      label: 'Morning',
      startTime: '2026-09-25T07:50:00.000Z',
      endTime: '2026-09-25T08:05:00.000Z',
    };

    it('should accept valid window creation', () => {
      expect(isValid(createWindowSchema, validData)).toBe(true);
    });

    it('should reject missing sessionId', () => {
      const { sessionId, ...rest } = validData;
      expect(isValid(createWindowSchema, rest)).toBe(false);
    });

    it('should reject missing label', () => {
      const { label, ...rest } = validData;
      expect(isValid(createWindowSchema, rest)).toBe(false);
    });

    it('should reject empty label', () => {
      expect(isValid(createWindowSchema, { ...validData, label: '' })).toBe(false);
    });

    it('should reject endTime before startTime', () => {
      expect(isValid(createWindowSchema, {
        ...validData,
        startTime: '2026-09-25T08:05:00.000Z',
        endTime: '2026-09-25T07:50:00.000Z',
      })).toBe(false);
    });

    it('should reject invalid sessionId', () => {
      expect(isValid(createWindowSchema, { ...validData, sessionId: 'bad' })).toBe(false);
    });

    it('should reject missing startTime', () => {
      const { startTime, ...rest } = validData;
      expect(isValid(createWindowSchema, rest)).toBe(false);
    });

    it('should reject missing endTime', () => {
      const { endTime, ...rest } = validData;
      expect(isValid(createWindowSchema, rest)).toBe(false);
    });
  });
});

// --- Service logic tests (QR) ---

import { generateQRToken } from '../services/attendance.service';

describe('Attendance Service — QR Token', () => {
  it('should generate a token and expiresInSeconds', () => {
    const result = generateQRToken(VALID_UUID);
    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('expiresInSeconds');
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBe(8);
    expect(result.expiresInSeconds).toBeGreaterThanOrEqual(0);
    expect(result.expiresInSeconds).toBeLessThanOrEqual(60);
  });

  it('should return the same token within the same 60s window', () => {
    const result1 = generateQRToken(VALID_UUID);
    const result2 = generateQRToken(VALID_UUID);
    expect(result1.token).toBe(result2.token);
  });

  it('should return different tokens for different windows', () => {
    const result1 = generateQRToken(VALID_UUID);
    const result2 = generateQRToken(VALID_UUID_2);
    expect(result1.token).not.toBe(result2.token);
  });
});

// --- Cutoff logic tests ---

describe('Attendance Service — Window-based Cutoff', () => {
  const originalDate = global.Date;

  afterEach(() => {
    global.Date = originalDate;
  });

  function mockTime(hours: number, minutes: number) {
    const mockDate = new Date(2026, 8, 25, hours, minutes, 0);
    global.Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(mockDate.getTime());
        } else {
          // @ts-ignore
          super(...args);
        }
        return this;
      }
      static now() {
        return mockDate.getTime();
      }
    } as any;
  }

  it('QR token generation works at 7:00 AM (before typical window)', () => {
    mockTime(7, 0);
    const result = generateQRToken(VALID_UUID);
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(8);
  });

  it('QR token generation works at 9:00 AM (after typical window)', () => {
    mockTime(9, 0);
    const result = generateQRToken(VALID_UUID);
    expect(result.token).toBeDefined();
  });

  it('tokens at different times in same 60s window match', () => {
    mockTime(7, 30);
    const token1 = generateQRToken(VALID_UUID).token;
    mockTime(7, 30);
    const token2 = generateQRToken(VALID_UUID).token;
    expect(token1).toBe(token2);
  });
});
