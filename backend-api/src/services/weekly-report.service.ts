import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { queueWeeklyReport } from '../jobs/queue';

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export { ServiceError };

export interface WeekBounds {
  weekStart: Date;
  weekEnd: Date;
}

/**
 * Returns the UTC offset in minutes for a given IANA timezone at a specific instant.
 * Positive = ahead of UTC (e.g., Asia/Kolkata = +330).
 */
function getTimezoneOffsetMinutes(tz: string, at: Date): number {
  const utcStr = at.toLocaleString('en-US', { timeZone: 'UTC' });
  const localStr = at.toLocaleString('en-US', { timeZone: tz });
  const utcMs = new Date(utcStr).getTime();
  const localMs = new Date(localStr).getTime();
  return Math.round((localMs - utcMs) / 60_000);
}

/**
 * Compute the most-recently completed Monday-to-Monday week in the
 * reporting timezone. Both boundaries are midnight local time converted to UTC.
 *
 * Example for Asia/Kolkata (UTC+5:30), reference 2026-10-05:
 *   Local Monday = 2026-09-28 00:00 IST = 2026-09-27T18:30:00.000Z
 *   Next Monday  = 2026-10-05 00:00 IST = 2026-10-04T18:30:00.000Z
 *   Range: [start, end) — exclusive end.
 */
export function computeWeekBounds(
  referenceDate: Date = new Date(),
  timezone: string = config.weeklyReport.timezone,
): WeekBounds {
  const offsetMin = getTimezoneOffsetMinutes(timezone, referenceDate);

  const localMs = referenceDate.getTime() + offsetMin * 60_000;
  const localDate = new Date(localMs);
  localDate.setUTCHours(0, 0, 0, 0);

  const dow = localDate.getUTCDay();
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const localMonday = new Date(localDate.getTime() - daysSinceMonday * 86_400_000);

  const weekEndUtc = new Date(localMonday.getTime() - offsetMin * 60_000);
  const weekStartUtc = new Date(weekEndUtc.getTime() - 7 * 86_400_000);

  return { weekStart: weekStartUtc, weekEnd: weekEndUtc };
}

const MAX_RANGE_DAYS = 31;

/**
 * Validate a custom date range.
 *
 * Custom ranges are arbitrary historical look-back windows, not necessarily
 * aligned to weekly boundaries. They are labelled "custom range" in the API
 * response. The 31-day cap prevents unbounded queries.
 */
export function validateDateRange(weekStart: Date, weekEnd: Date): void {
  if (isNaN(weekStart.getTime())) {
    throw new ServiceError('Invalid weekStart date', 400);
  }
  if (isNaN(weekEnd.getTime())) {
    throw new ServiceError('Invalid weekEnd date', 400);
  }
  if (weekEnd <= weekStart) {
    throw new ServiceError('weekEnd must be after weekStart', 400);
  }
  const diffMs = weekEnd.getTime() - weekStart.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > MAX_RANGE_DAYS) {
    throw new ServiceError(`Date range must not exceed ${MAX_RANGE_DAYS} days`, 400);
  }
}

export interface ReportStudent {
  studentId: string;
  name: string;
  riskLevel: string;
  riskScore: number;
  trend: string;
  reasons: string[];
  dataAvailability: { attendance: boolean; assessment: boolean; feedback: boolean } | null;
  batchId: string | null;
}

export interface WeeklyReportData {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  weekStart: Date;
  weekEnd: Date;
  students: ReportStudent[];
  generatedAt: Date;
}

function extractBatchId(factors: unknown): string | null {
  if (!factors || typeof factors !== 'object') return null;
  const f = factors as Record<string, unknown>;
  if (!f.scope || typeof f.scope !== 'object') return null;
  return (f.scope as Record<string, unknown>).batchId as string | null;
}

function extractReasons(factors: unknown): string[] {
  const reasons: string[] = [];
  if (!factors || typeof factors !== 'object') return reasons;
  const f = factors as Record<string, unknown>;
  const rb = f.ruleBased as Record<string, unknown> | undefined;
  if (!rb) return reasons;

  const details = rb.details as Record<string, unknown> | undefined;

  if (typeof rb.attendanceRisk === 'number' && rb.attendanceRisk > 0) {
    const pct = details?.attendancePercentage;
    reasons.push(
      `Low attendance${typeof pct === 'number' ? `: ${pct.toFixed(1)}%` : ''}`,
    );
  }
  if (typeof rb.assessmentRisk === 'number' && rb.assessmentRisk > 0) {
    const pct = details?.averageAssessmentScore;
    reasons.push(
      `Low assessment score${typeof pct === 'number' ? `: ${pct.toFixed(1)}%` : ''}`,
    );
  }
  if (typeof rb.feedbackRisk === 'number' && rb.feedbackRisk > 0) {
    reasons.push('Negative feedback detected');
  }
  return reasons;
}

function extractDataAvailability(
  factors: unknown,
): { attendance: boolean; assessment: boolean; feedback: boolean } | null {
  if (!factors || typeof factors !== 'object') return null;
  const f = factors as Record<string, unknown>;
  const da = f.dataAvailability as Record<string, boolean> | undefined;
  if (!da) return null;
  return {
    attendance: !!da.attendance,
    assessment: !!da.assessment,
    feedback: !!da.feedback,
  };
}

export async function generateWeeklyReportData(
  mentorId: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<WeeklyReportData> {
  const mentor = await prisma.user.findUnique({
    where: { id: mentorId },
    select: { id: true, name: true, email: true },
  });

  if (!mentor) {
    throw new ServiceError('Mentor not found', 404);
  }

  const assignments = await prisma.mentorAssignment.findMany({
    where: { mentorId },
    include: { student: { select: { id: true, name: true } } },
  });

  const studentIds = assignments.map((a) => a.studentId);

  if (studentIds.length === 0) {
    return {
      mentorId,
      mentorName: mentor.name,
      mentorEmail: mentor.email,
      weekStart,
      weekEnd,
      students: [],
      generatedAt: new Date(),
    };
  }

  // Fetch ALL risk scores in the current week — no pre-filtering by riskLevel
  const currentWeekScores = await prisma.riskScore.findMany({
    where: {
      studentId: { in: studentIds },
      generatedAt: {
        gte: weekStart,
        lt: weekEnd,
      },
    },
    include: { student: { select: { name: true } } },
    orderBy: { generatedAt: 'desc' },
  });

  // Take the latest score per student (ordered desc, first wins)
  const latestByStudent = new Map<string, (typeof currentWeekScores)[0]>();
  for (const score of currentWeekScores) {
    if (!latestByStudent.has(score.studentId)) {
      latestByStudent.set(score.studentId, score);
    }
  }

  // Filter for MEDIUM/HIGH AFTER selecting the latest
  const atRiskLatest = new Map<string, (typeof currentWeekScores)[0]>();
  for (const [studentId, score] of latestByStudent) {
    if (score.riskLevel === 'MEDIUM' || score.riskLevel === 'HIGH') {
      atRiskLatest.set(studentId, score);
    }
  }

  // Fetch previous week scores — non-overlapping boundary (lt weekStart)
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);

  const previousWeekScores = await prisma.riskScore.findMany({
    where: {
      studentId: { in: studentIds },
      generatedAt: {
        gte: prevWeekStart,
        lt: weekStart,
      },
    },
    orderBy: { generatedAt: 'desc' },
  });

  const prevByStudent = new Map<string, (typeof previousWeekScores)[0]>();
  for (const score of previousWeekScores) {
    if (!prevByStudent.has(score.studentId)) {
      prevByStudent.set(score.studentId, score);
    }
  }

  const students: ReportStudent[] = Array.from(atRiskLatest.values()).map(
    (score) => {
      const batchId = extractBatchId(score.factors);

      let trend = 'N/A';
      const prevScore = prevByStudent.get(score.studentId);
      if (prevScore) {
        const prevBatchId = extractBatchId(prevScore.factors);
        if (batchId === prevBatchId) {
          const diff = score.totalScore - prevScore.totalScore;
          if (diff > 5) trend = '↑ Worsening';
          else if (diff < -5) trend = '↓ Improving';
          else trend = '→ Stable';
        } else {
          trend = 'N/A (different batch)';
        }
      }

      const reasons = extractReasons(score.factors);
      if (reasons.length === 0) {
        reasons.push('Elevated risk from combined factors');
      }

      return {
        studentId: score.studentId,
        name: score.student.name,
        riskLevel: score.riskLevel,
        riskScore: score.totalScore,
        trend,
        reasons,
        dataAvailability: extractDataAvailability(score.factors),
        batchId,
      };
    },
  );

  students.sort((a, b) => b.riskScore - a.riskScore);

  return {
    mentorId,
    mentorName: mentor.name,
    mentorEmail: mentor.email,
    weekStart,
    weekEnd,
    students,
    generatedAt: new Date(),
  };
}

export async function scheduleAllWeeklyReports(
  weekStart?: Date,
  weekEnd?: Date,
): Promise<{ queued: number; mentorIds: string[] }> {
  const bounds =
    weekStart && weekEnd ? { weekStart, weekEnd } : computeWeekBounds();

  const mentors = await prisma.mentorAssignment.findMany({
    select: { mentorId: true },
    distinct: ['mentorId'],
  });

  const mentorIds = mentors.map((m) => m.mentorId);

  for (const mentorId of mentorIds) {
    await queueWeeklyReport({
      mentorId,
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
    });
  }

  logger.info('Weekly reports scheduled', {
    event: 'weekly_report.scheduled',
    mentorCount: mentorIds.length,
    weekStart: bounds.weekStart.toISOString(),
    weekEnd: bounds.weekEnd.toISOString(),
  });

  return { queued: mentorIds.length, mentorIds };
}

export function getScheduleConfig() {
  return {
    enabled: config.weeklyReport.enabled,
    dayOfWeek: config.weeklyReport.dayOfWeek,
    hour: config.weeklyReport.hour,
    timezone: config.weeklyReport.timezone,
    cronExpression: `0 ${config.weeklyReport.hour} * * ${config.weeklyReport.dayOfWeek}`,
  };
}
