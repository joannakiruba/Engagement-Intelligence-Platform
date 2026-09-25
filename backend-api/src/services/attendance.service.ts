import crypto from 'crypto';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { AttendanceStatus } from '@prisma/client';
import ExcelJS from 'exceljs';

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export { ServiceError };

const QR_ROTATION_SECONDS = 60;

// --- QR Token helpers ---

function getQRSecret(windowId: string): string {
  const base = process.env.QR_SECRET || 'hope-qr-default-secret';
  return crypto.createHmac('sha256', base).update(windowId).digest('hex');
}

function generateTOTP(secret: string, timeStep: number): string {
  return crypto
    .createHmac('sha256', secret)
    .update(String(timeStep))
    .digest('hex')
    .slice(0, 8);
}

export function generateQRToken(windowId: string): { token: string; expiresInSeconds: number } {
  const secret = getQRSecret(windowId);
  const timeStep = Math.floor(Date.now() / 1000 / QR_ROTATION_SECONDS);
  const token = generateTOTP(secret, timeStep);
  const elapsed = (Date.now() / 1000) % QR_ROTATION_SECONDS;
  return { token, expiresInSeconds: Math.floor(QR_ROTATION_SECONDS - elapsed) };
}

function validateQRToken(windowId: string, token: string): boolean {
  const secret = getQRSecret(windowId);
  const timeStep = Math.floor(Date.now() / 1000 / QR_ROTATION_SECONDS);
  return (
    generateTOTP(secret, timeStep) === token ||
    generateTOTP(secret, timeStep - 1) === token
  );
}

// --- Redis helpers ---

async function cacheQRToken(windowId: string, token: string, ttl: number): Promise<void> {
  try {
    await redis.set(`qr:${windowId}`, token, 'EX', ttl);
  } catch {
    // Redis unavailable — fall through to in-memory generation
  }
}

async function cacheCheckIn(windowId: string, studentId: string): Promise<void> {
  try {
    await redis.sadd(`checkins:${windowId}`, studentId);
    await redis.expire(`checkins:${windowId}`, 86400);
  } catch {
    // Redis unavailable — fall through
  }
}

async function getCheckedInCount(windowId: string): Promise<number> {
  try {
    return await redis.scard(`checkins:${windowId}`);
  } catch {
    return 0;
  }
}

async function isAlreadyCheckedIn(windowId: string, studentId: string): Promise<boolean> {
  try {
    return (await redis.sismember(`checkins:${windowId}`, studentId)) === 1;
  } catch {
    return false;
  }
}

async function cacheWindowMeta(windowId: string, meta: { sessionId: string; startTime: string; endTime: string; batchId: string }): Promise<void> {
  try {
    await redis.set(`window:${windowId}`, JSON.stringify(meta), 'EX', 86400);
  } catch {
    // fall through
  }
}

async function getCachedWindowMeta(windowId: string): Promise<{ sessionId: string; startTime: string; endTime: string; batchId: string } | null> {
  try {
    const data = await redis.get(`window:${windowId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function cacheBatchMembers(batchId: string, memberIds: string[]): Promise<void> {
  try {
    if (memberIds.length > 0) {
      await redis.sadd(`batch:${batchId}:members`, ...memberIds);
      await redis.expire(`batch:${batchId}:members`, 86400);
    }
  } catch {
    // fall through
  }
}

async function isCachedBatchMember(batchId: string, studentId: string): Promise<boolean | null> {
  try {
    const exists = await redis.exists(`batch:${batchId}:members`);
    if (!exists) return null;
    return (await redis.sismember(`batch:${batchId}:members`, studentId)) === 1;
  } catch {
    return null;
  }
}

// --- Attendance window helpers ---

function isWithinWindow(window: { startTime: Date; endTime: Date }, now: Date): boolean {
  return now >= window.startTime && now <= window.endTime;
}

// --- AttendanceWindow CRUD ---

export async function createAttendanceWindow(
  sessionId: string,
  label: string,
  startTime: Date,
  endTime: Date
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { batch: { include: { members: true } } },
  });
  if (!session) throw new ServiceError('Session not found', 404);

  const window = await prisma.attendanceWindow.create({
    data: { sessionId, label, startTime, endTime },
  });

  // Default all batch students to ABSENT for this window
  const attendanceData = session.batch.members.map((m) => ({
    windowId: window.id,
    sessionId,
    studentId: m.studentId,
    status: 'ABSENT' as AttendanceStatus,
  }));

  if (attendanceData.length > 0) {
    await prisma.attendance.createMany({ data: attendanceData });
  }

  return window;
}

export async function getSessionWindows(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new ServiceError('Session not found', 404);

  return prisma.attendanceWindow.findMany({
    where: { sessionId },
    orderBy: { startTime: 'asc' },
  });
}

// --- Student self-check-in (thundering herd protected) ---

export async function studentCheckIn(
  windowId: string,
  studentId: string,
  qrToken?: string
) {
  // Gate 1: Redis fast-path — if already checked in, skip all DB queries
  if (await isAlreadyCheckedIn(windowId, studentId)) {
    throw new ServiceError('Attendance already recorded for this window', 409);
  }

  // Gate 2: QR token validation — pure CPU, no DB
  if (qrToken && !validateQRToken(windowId, qrToken)) {
    throw new ServiceError('Invalid or expired QR code', 400);
  }

  // Gate 3: Window time check — try Redis cache first, fall back to DB
  const now = new Date();
  let windowSessionId: string;

  const cached = await getCachedWindowMeta(windowId);
  if (cached) {
    if (!isWithinWindow({ startTime: new Date(cached.startTime), endTime: new Date(cached.endTime) }, now)) {
      throw new ServiceError(
        `Check-in closed — attendance window was ${new Date(cached.startTime).toLocaleTimeString()} to ${new Date(cached.endTime).toLocaleTimeString()}. Contact your trainer for manual entry.`,
        403
      );
    }
    windowSessionId = cached.sessionId;

    // Gate 4: Batch membership — try Redis cache first
    const cachedMember = await isCachedBatchMember(cached.batchId, studentId);
    if (cachedMember === false) {
      throw new ServiceError('Student is not enrolled in this batch', 403);
    }

    // If cachedMember is true, skip DB. If null (no cache), fall through to DB check below.
    if (cachedMember === true) {
      return await writeCheckIn(windowId, windowSessionId, studentId, now);
    }
  }

  // DB fallback — cache miss or first request for this window
  const window = await prisma.attendanceWindow.findUnique({
    where: { id: windowId },
    include: { session: { include: { batch: { include: { members: true } } } } },
  });
  if (!window) throw new ServiceError('Attendance window not found', 404);

  // Cache window metadata + batch members for subsequent requests
  await cacheWindowMeta(windowId, {
    sessionId: window.sessionId,
    startTime: window.startTime.toISOString(),
    endTime: window.endTime.toISOString(),
    batchId: window.session.batchId,
  });
  await cacheBatchMembers(window.session.batchId, window.session.batch.members.map((m) => m.studentId));

  const isMember = window.session.batch.members.some((m) => m.studentId === studentId);
  if (!isMember) throw new ServiceError('Student is not enrolled in this batch', 403);

  if (!isWithinWindow(window, now)) {
    throw new ServiceError(
      `Check-in closed — attendance window was ${new Date(window.startTime).toLocaleTimeString()} to ${new Date(window.endTime).toLocaleTimeString()}. Contact your trainer for manual entry.`,
      403
    );
  }

  return await writeCheckIn(windowId, window.sessionId, studentId, now);
}

async function writeCheckIn(windowId: string, sessionId: string, studentId: string, now: Date) {
  const existing = await prisma.attendance.findUnique({
    where: { windowId_studentId: { windowId, studentId } },
  });

  if (existing && existing.status === 'PRESENT') {
    await cacheCheckIn(windowId, studentId);
    throw new ServiceError('Attendance already recorded for this window', 409);
  }

  await cacheCheckIn(windowId, studentId);

  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data: { status: 'PRESENT', checkInTime: now },
      include: {
        student: { select: { id: true, name: true, email: true } },
        session: { select: { id: true, title: true } },
      },
    });
  }

  return prisma.attendance.create({
    data: {
      windowId,
      sessionId,
      studentId,
      status: 'PRESENT',
      checkInTime: now,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, title: true } },
    },
  });
}

// --- Trainer marks single student ---

export async function markAttendance(
  windowId: string,
  studentId: string,
  status: AttendanceStatus,
  remarks?: string
) {
  const window = await prisma.attendanceWindow.findUnique({
    where: { id: windowId },
    include: { session: true },
  });
  if (!window) throw new ServiceError('Attendance window not found', 404);

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new ServiceError('Student not found', 404);

  return prisma.attendance.upsert({
    where: { windowId_studentId: { windowId, studentId } },
    update: { status, remarks, checkInTime: status === 'PRESENT' || status === 'LATE' ? new Date() : null },
    create: {
      windowId,
      sessionId: window.sessionId,
      studentId,
      status,
      remarks,
      checkInTime: status === 'PRESENT' || status === 'LATE' ? new Date() : null,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, title: true } },
    },
  });
}

// --- Trainer bulk marks a whole window ---

export async function bulkMarkAttendance(
  windowId: string,
  records: { studentId: string; status: AttendanceStatus; remarks?: string }[]
) {
  const window = await prisma.attendanceWindow.findUnique({
    where: { id: windowId },
    include: { session: true },
  });
  if (!window) throw new ServiceError('Attendance window not found', 404);

  const results: { studentId: string; status: string; error?: string }[] = [];

  for (const record of records) {
    try {
      await prisma.attendance.upsert({
        where: { windowId_studentId: { windowId, studentId: record.studentId } },
        update: {
          status: record.status,
          remarks: record.remarks,
          checkInTime: record.status === 'PRESENT' || record.status === 'LATE' ? new Date() : null,
        },
        create: {
          windowId,
          sessionId: window.sessionId,
          studentId: record.studentId,
          status: record.status,
          remarks: record.remarks,
          checkInTime: record.status === 'PRESENT' || record.status === 'LATE' ? new Date() : null,
        },
      });
      results.push({ studentId: record.studentId, status: 'success' });
    } catch {
      results.push({ studentId: record.studentId, status: 'error', error: 'Failed to upsert' });
    }
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  return { total: records.length, success: successCount, errors: records.length - successCount, details: results };
}

// --- Update existing record (trainer override) ---

export async function updateAttendance(
  attendanceId: string,
  data: { status?: AttendanceStatus; remarks?: string }
) {
  const existing = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!existing) throw new ServiceError('Attendance record not found', 404);

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'PRESENT' || data.status === 'LATE') {
      updateData.checkInTime = existing.checkInTime ?? new Date();
    }
  }
  if (data.remarks !== undefined) updateData.remarks = data.remarks;

  return prisma.attendance.update({
    where: { id: attendanceId },
    data: updateData,
    include: {
      student: { select: { id: true, name: true, email: true } },
      session: { select: { id: true, title: true } },
    },
  });
}

// --- Get attendance for a window ---

export async function getWindowAttendance(windowId: string) {
  const window = await prisma.attendanceWindow.findUnique({
    where: { id: windowId },
    include: {
      session: {
        include: {
          batch: {
            include: {
              members: {
                include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!window) throw new ServiceError('Attendance window not found', 404);

  const records = await prisma.attendance.findMany({
    where: { windowId },
    include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const attendedIds = new Set(records.map((r) => r.studentId));
  const unmarked = window.session.batch.members
    .filter((m) => !attendedIds.has(m.studentId))
    .map((m) => ({ studentId: m.studentId, student: m.student, status: 'NOT_MARKED' as const }));

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const total = window.session.batch.members.length;

  const checkedInCount = await getCheckedInCount(windowId);

  return {
    window: { id: window.id, label: window.label, startTime: window.startTime, endTime: window.endTime },
    session: { id: window.session.id, title: window.session.title, scheduledDate: window.session.scheduledDate },
    summary: { total, present, absent, late, excused, unmarked: unmarked.length, checkedInLive: checkedInCount },
    records,
    unmarked,
  };
}

// --- Get attendance for a session (all windows) ---

export async function getSessionAttendance(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      attendanceWindows: { orderBy: { startTime: 'asc' } },
      batch: {
        include: {
          members: {
            include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } },
          },
        },
      },
    },
  });
  if (!session) throw new ServiceError('Session not found', 404);

  const records = await prisma.attendance.findMany({
    where: { sessionId },
    include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const attendedIds = new Set(records.map((r) => r.studentId));
  const unmarked = session.batch.members
    .filter((m) => !attendedIds.has(m.studentId))
    .map((m) => ({ studentId: m.studentId, student: m.student, status: 'NOT_MARKED' as const }));

  const present = records.filter((r) => r.status === 'PRESENT').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const total = session.batch.members.length;

  return {
    session: { id: session.id, title: session.title, scheduledDate: session.scheduledDate },
    windows: session.attendanceWindows,
    summary: { total, present, absent, late, excused, unmarked: unmarked.length },
    records,
    unmarked,
  };
}

// --- Get attendance history for a student ---

export async function getStudentAttendance(
  studentId: string,
  filters?: { batchId?: string; from?: string; to?: string }
) {
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new ServiceError('Student not found', 404);

  const where: Record<string, unknown> = { studentId };
  if (filters?.batchId || filters?.from || filters?.to) {
    const sessionFilter: Record<string, unknown> = {};
    if (filters.batchId) sessionFilter.batchId = filters.batchId;
    if (filters.from || filters.to) {
      sessionFilter.scheduledDate = {};
      if (filters.from) (sessionFilter.scheduledDate as Record<string, unknown>).gte = new Date(filters.from);
      if (filters.to) (sessionFilter.scheduledDate as Record<string, unknown>).lte = new Date(filters.to);
    }
    where.session = sessionFilter;
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      session: { select: { id: true, title: true, scheduledDate: true, batch: { select: { id: true, name: true } } } },
      window: { select: { id: true, label: true, startTime: true, endTime: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const late = records.filter((r) => r.status === 'LATE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const excused = records.filter((r) => r.status === 'EXCUSED').length;
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return {
    student: { id: student.id, name: student.name, email: student.email, department: student.department, year: student.year },
    summary: { total, present, late, absent, excused, attendanceRate },
    records,
  };
}

// --- Batch-level attendance stats ---

export async function getBatchAttendanceStats(batchId: string) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      members: { include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } } },
      sessions: { select: { id: true } },
    },
  });
  if (!batch) throw new ServiceError('Batch not found', 404);

  const sessionIds = batch.sessions.map((s) => s.id);

  const records = await prisma.attendance.findMany({
    where: { sessionId: { in: sessionIds } },
  });

  const studentStats = batch.members.map((member) => {
    const studentRecords = records.filter((r) => r.studentId === member.studentId);
    const total = studentRecords.length;
    const present = studentRecords.filter((r) => r.status === 'PRESENT').length;
    const late = studentRecords.filter((r) => r.status === 'LATE').length;
    const absent = studentRecords.filter((r) => r.status === 'ABSENT').length;
    const excused = studentRecords.filter((r) => r.status === 'EXCUSED').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { student: member.student, total, present, late, absent, excused, attendanceRate: rate };
  });

  const overallRate =
    studentStats.length > 0
      ? Math.round(studentStats.reduce((sum, s) => sum + s.attendanceRate, 0) / studentStats.length)
      : 0;

  return {
    batch: { id: batch.id, name: batch.name },
    totalSessions: sessionIds.length,
    overallAttendanceRate: overallRate,
    students: studentStats.sort((a, b) => a.attendanceRate - b.attendanceRate),
  };
}

// --- Status code helpers ---

const STATUS_CODE: Record<AttendanceStatus, string> = {
  PRESENT: 'P',
  ABSENT: 'A',
  LATE: 'L',
  EXCUSED: 'E',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- CSV export for a session ---

export async function exportSessionAttendanceCsv(sessionId: string): Promise<string> {
  const data = await getSessionAttendance(sessionId);

  const rows = [['Student Name', 'Email', 'Department', 'Year', 'Status', 'Check-In Time', 'Remarks']];

  for (const record of data.records) {
    rows.push([
      record.student.name,
      record.student.email,
      record.student.department || '',
      record.student.year != null ? String(record.student.year) : '',
      STATUS_CODE[record.status as AttendanceStatus] || record.status,
      record.checkInTime ? new Date(record.checkInTime).toISOString() : '',
      record.remarks ?? '',
    ]);
  }

  for (const um of data.unmarked) {
    rows.push([um.student.name, um.student.email, um.student.department || '', um.student.year != null ? String(um.student.year) : '', 'A', '', '']);
  }

  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// --- Excel export for batch attendance ---

export async function exportBatchAttendanceExcel(
  batchId: string,
  filters?: { from?: string; to?: string; sessionId?: string }
): Promise<ExcelJS.Workbook> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      members: {
        include: { student: { select: { id: true, name: true, email: true, department: true, year: true } } },
      },
      sessions: {
        include: { attendanceWindows: { orderBy: { startTime: 'asc' } } },
        orderBy: { scheduledDate: 'asc' },
      },
    },
  });
  if (!batch) throw new ServiceError('Batch not found', 404);

  let sessions = batch.sessions;
  if (filters?.sessionId) {
    sessions = sessions.filter((s) => s.id === filters.sessionId);
  }
  if (filters?.from) {
    const fromDate = new Date(filters.from);
    sessions = sessions.filter((s) => s.scheduledDate >= fromDate);
  }
  if (filters?.to) {
    const toDate = new Date(filters.to);
    sessions = sessions.filter((s) => s.scheduledDate <= toDate);
  }

  const allWindowIds = sessions.flatMap((s) => s.attendanceWindows.map((w) => w.id));
  const allRecords = await prisma.attendance.findMany({
    where: { windowId: { in: allWindowIds } },
  });

  const recordMap = new Map<string, typeof allRecords[0]>();
  for (const r of allRecords) {
    recordMap.set(`${r.windowId}:${r.studentId}`, r);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');

  const headerRow = ['Name', 'Email', 'Department', 'Year'];
  const windowMeta: { sessionTitle: string; date: Date; day: string; windowLabel: string }[] = [];

  for (const session of sessions) {
    for (const w of session.attendanceWindows) {
      const date = new Date(session.scheduledDate);
      const day = DAY_NAMES[date.getDay()];
      headerRow.push(`${session.title} - ${w.label} (${date.toLocaleDateString()} ${day})`);
      windowMeta.push({ sessionTitle: session.title, date, day, windowLabel: w.label });
    }
  }
  headerRow.push('Attendance %');

  sheet.addRow(headerRow);

  const headerRowObj = sheet.getRow(1);
  headerRowObj.font = { bold: true };
  headerRowObj.alignment = { horizontal: 'center' };

  for (const member of batch.members) {
    const student = member.student;
    const row: (string | number)[] = [
      student.name,
      student.email,
      student.department || '',
      student.year != null ? student.year : '',
    ];

    let totalWindows = 0;
    let attended = 0;

    for (const session of sessions) {
      for (const w of session.attendanceWindows) {
        totalWindows++;
        const record = recordMap.get(`${w.id}:${student.id}`);
        const status = record?.status || 'ABSENT';
        row.push(STATUS_CODE[status as AttendanceStatus] || 'A');
        if (status === 'PRESENT' || status === 'LATE') attended++;
      }
    }

    const rate = totalWindows > 0 ? Math.round((attended / totalWindows) * 100) : 0;
    row.push(`${rate}%`);
    sheet.addRow(row);
  }

  sheet.columns.forEach((col) => {
    col.width = 18;
  });

  return workbook;
}

// --- Generate QR data for a window ---

export async function generateQRForWindow(windowId: string) {
  const window = await prisma.attendanceWindow.findUnique({
    where: { id: windowId },
    include: { session: true },
  });
  if (!window) throw new ServiceError('Attendance window not found', 404);

  const { token, expiresInSeconds } = generateQRToken(windowId);

  await cacheQRToken(windowId, token, expiresInSeconds);

  const checkedInCount = await getCheckedInCount(windowId);

  const isOpen = isWithinWindow(window, new Date());

  return {
    token,
    expiresInSeconds,
    windowId,
    sessionId: window.sessionId,
    label: window.label,
    isOpen,
    checkedInCount,
    windowStart: window.startTime,
    windowEnd: window.endTime,
  };
}
