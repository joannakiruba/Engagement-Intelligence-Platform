import prisma from '../lib/prisma';

export interface AttendanceStats {
  totalSessions: number;
  sessionsAttended: number;
  attendancePercentage: number;
}

export async function getAttendanceStats(
  studentId: string,
  batchId: string,
): Promise<AttendanceStats | null> {
  const sessions = await prisma.session.findMany({
    where: { batchId },
    select: { id: true },
  });

  if (sessions.length === 0) return null;

  const sessionIds = sessions.map((s) => s.id);

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      studentId,
      sessionId: { in: sessionIds },
    },
    select: { status: true },
  });

  if (attendanceRecords.length === 0) return null;

  const sessionsAttended = attendanceRecords.filter(
    (a) => a.status === 'PRESENT' || a.status === 'LATE',
  ).length;

  const totalSessions = sessions.length;
  const attendancePercentage = (sessionsAttended / totalSessions) * 100;

  return { totalSessions, sessionsAttended, attendancePercentage };
}
