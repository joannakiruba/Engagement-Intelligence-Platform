import prisma from '../lib/prisma';

export class ServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface WeekBounds {
  start: Date;
  end: Date;
}

export function getMonday(dateStr?: string): Date {
  if (dateStr) {
    const dateOnly = dateStr.slice(0, 10);
    return new Date(dateOnly + 'T00:00:00.000Z');
  }
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return monday;
}

export function getWeekBounds(mondayDate: Date): WeekBounds {
  const start = new Date(mondayDate);
  const sunday = new Date(start);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const now = new Date();
  const end = sunday < now ? sunday : now;

  return { start, end };
}

function calcAttendanceScore(records: { status: string }[]): number {
  if (records.length === 0) return 0;
  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const lateCount = records.filter(r => r.status === 'LATE').length;
  return Math.round(((presentCount + lateCount) / records.length) * 100);
}

function calcAssessmentScore(results: { score: number; maxScore: number }[]): number {
  const valid = results.filter(r => r.maxScore > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((acc, r) => acc + (r.score / r.maxScore) * 100, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function calcContestScore(
  participatedCount: number,
  totalEvents: number,
): number {
  if (totalEvents === 0) return 0;
  return Math.round((participatedCount / totalEvents) * 100);
}

interface StudentRanking {
  rank: number;
  studentId: string;
  studentName: string;
  attendanceScore: number;
  assessmentScore: number;
  contestScore: number;
  finalScore: number;
  breakdown: {
    attendanceWeighted: number;
    assessmentWeighted: number;
    contestWeighted: number;
  };
}

export interface LeaderboardResult {
  batch: { id: string; name: string };
  week: { start: string; end: string; label: string };
  generatedAt: string;
  totalStudents: number;
  contestDataAvailable: boolean;
  rankings: StudentRanking[];
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function getWeeklyLeaderboard(batchId: string, weekParam?: string): Promise<LeaderboardResult> {
  const monday = getMonday(weekParam);
  const { start: weekStart, end: weekEnd } = getWeekBounds(monday);

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true },
  });
  if (!batch) throw new ServiceError('Batch not found', 404);

  const members = await prisma.batchMember.findMany({
    where: { batchId },
    include: {
      student: { select: { id: true, name: true, status: true } },
    },
  });

  const activeStudents = members
    .filter(m => m.student.status === 'ACTIVE')
    .map(m => m.student);

  if (activeStudents.length === 0) {
    const weekNumber = getISOWeekNumber(monday);
    return {
      batch: { id: batch.id, name: batch.name },
      week: {
        start: monday.toISOString().slice(0, 10),
        end: new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10),
        label: `Week ${weekNumber}, ${monday.getUTCFullYear()}`,
      },
      generatedAt: new Date().toISOString(),
      totalStudents: 0,
      contestDataAvailable: false,
      rankings: [],
    };
  }

  const studentIds = activeStudents.map(s => s.id);

  const sessions = await prisma.session.findMany({
    where: {
      batchId,
      scheduledDate: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true },
  });
  const sessionIds = sessions.map(s => s.id);

  const attendanceRecords = sessionIds.length > 0
    ? await prisma.attendance.findMany({
        where: { sessionId: { in: sessionIds }, studentId: { in: studentIds } },
        select: { studentId: true, status: true },
      })
    : [];

  const assessments = await prisma.assessment.findMany({
    where: {
      batchId,
      assessmentDate: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true, maxScore: true },
  });
  const assessmentIds = assessments.map(a => a.id);

  const assessmentResults = assessmentIds.length > 0
    ? await prisma.assessmentResult.findMany({
        where: { assessmentId: { in: assessmentIds }, studentId: { in: studentIds } },
        include: { assessment: { select: { maxScore: true } } },
      })
    : [];

  const events = await prisma.event.findMany({
    where: {
      eventDate: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true },
  });
  const eventIds = events.map(e => e.id);
  const contestDataAvailable = eventIds.length > 0;

  const registrations = eventIds.length > 0
    ? await prisma.eventRegistration.findMany({
        where: { eventId: { in: eventIds }, studentId: { in: studentIds } },
        select: { studentId: true, eventId: true },
      })
    : [];

  const approvedProofs = eventIds.length > 0
    ? await prisma.proofSubmission.findMany({
        where: {
          eventId: { in: eventIds },
          studentId: { in: studentIds },
          status: 'APPROVED',
        },
        select: { studentId: true, eventId: true },
      })
    : [];

  // Group by studentId using Maps
  const attendanceByStudent = new Map<string, { status: string }[]>();
  for (const record of attendanceRecords) {
    const list = attendanceByStudent.get(record.studentId);
    if (list) list.push(record);
    else attendanceByStudent.set(record.studentId, [record]);
  }

  const assessmentByStudent = new Map<string, { score: number; maxScore: number }[]>();
  for (const result of assessmentResults) {
    const entry = { score: result.score, maxScore: result.assessment.maxScore };
    const list = assessmentByStudent.get(result.studentId);
    if (list) list.push(entry);
    else assessmentByStudent.set(result.studentId, [entry]);
  }

  const participationByStudent = new Map<string, Set<string>>();
  for (const reg of registrations) {
    const set = participationByStudent.get(reg.studentId);
    if (set) set.add(reg.eventId);
    else participationByStudent.set(reg.studentId, new Set([reg.eventId]));
  }
  for (const proof of approvedProofs) {
    const set = participationByStudent.get(proof.studentId);
    if (set) set.add(proof.eventId);
    else participationByStudent.set(proof.studentId, new Set([proof.eventId]));
  }

  // Calculate scores
  const scored = activeStudents.map(student => {
    const attRecords = attendanceByStudent.get(student.id) ?? [];
    const assResults = assessmentByStudent.get(student.id) ?? [];
    const participatedEvents = participationByStudent.get(student.id)?.size ?? 0;

    const attendanceScore = calcAttendanceScore(attRecords);
    const assessmentScore = calcAssessmentScore(assResults);
    const contestScore = calcContestScore(participatedEvents, eventIds.length);

    const attendanceWeighted = Math.round(attendanceScore * 0.30 * 100) / 100;
    const assessmentWeighted = Math.round(assessmentScore * 0.50 * 100) / 100;
    const contestWeighted = Math.round(contestScore * 0.20 * 100) / 100;
    const finalScore = Math.round((attendanceWeighted + assessmentWeighted + contestWeighted) * 100) / 100;

    return {
      studentId: student.id,
      studentName: student.name,
      attendanceScore,
      assessmentScore,
      contestScore,
      finalScore,
      breakdown: { attendanceWeighted, assessmentWeighted, contestWeighted },
    };
  });

  // Sort with tie-breaking
  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.assessmentScore !== a.assessmentScore) return b.assessmentScore - a.assessmentScore;
    if (b.attendanceScore !== a.attendanceScore) return b.attendanceScore - a.attendanceScore;
    return a.studentName.localeCompare(b.studentName);
  });

  const top10 = scored.slice(0, 10);
  const rankings: StudentRanking[] = top10.map((s, i) => ({
    rank: i + 1,
    ...s,
  }));

  const weekNumber = getISOWeekNumber(monday);
  const sundayDate = new Date(monday.getTime() + 6 * 86400000);

  return {
    batch: { id: batch.id, name: batch.name },
    week: {
      start: monday.toISOString().slice(0, 10),
      end: sundayDate.toISOString().slice(0, 10),
      label: `Week ${weekNumber}, ${monday.getUTCFullYear()}`,
    },
    generatedAt: new Date().toISOString(),
    totalStudents: activeStudents.length,
    contestDataAvailable,
    rankings,
  };
}
