import prisma from '../lib/prisma';
import { AttendanceStatus, AssessmentType } from '@prisma/client';

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

export type TimelineEventType = 'SESSION' | 'ASSESSMENT';

export interface SessionEvent {
  type: 'SESSION';
  date: Date;
  session: {
    id: string;
    title: string;
    topic: string | null;
  };
  attendance: AttendanceStatus | null;
}

export interface AssessmentEvent {
  type: 'ASSESSMENT';
  date: Date;
  assessment: {
    id: string;
    title: string;
    type: AssessmentType;
  };
  score: {
    obtained: number;
    maximum: number;
    percentage: number;
  } | null;
  remarks: string | null;
}

export type TimelineEvent = SessionEvent | AssessmentEvent;

export interface TrainingHistoryFilters {
  from?: string;
  to?: string;
}

export interface PaginatedTrainingHistory {
  items: TimelineEvent[];
  total: number;
}

/**
 * Resolve attendance status for a student+session combination.
 * A session may have multiple attendance windows, but we only want one timeline entry per session.
 *
 * Priority order (first non-null status wins):
 * 1. PRESENT (if any window shows PRESENT)
 * 2. LATE (if any window shows LATE)
 * 3. EXCUSED (if any window shows EXCUSED)
 * 4. ABSENT (if all windows show ABSENT or no attendance exists)
 */
function resolveAttendanceStatus(attendances: { status: AttendanceStatus }[]): AttendanceStatus | null {
  if (attendances.length === 0) return null;

  const statuses = attendances.map((a) => a.status);

  if (statuses.includes('PRESENT')) return 'PRESENT';
  if (statuses.includes('LATE')) return 'LATE';
  if (statuses.includes('EXCUSED')) return 'EXCUSED';
  if (statuses.includes('ABSENT')) return 'ABSENT';

  return null;
}

/**
 * Safely calculate percentage, avoiding division by zero.
 */
function calculatePercentage(obtained: number, maximum: number): number {
  if (maximum === 0 || maximum === null || maximum === undefined) {
    return 0;
  }
  return Math.round((obtained / maximum) * 10000) / 100;
}

/**
 * Fetch training history for a specific student.
 * Combines session attendance and assessment results into a unified chronological timeline.
 */
export async function getTrainingHistory(
  studentId: string,
  filters: TrainingHistoryFilters,
  page: number,
  limit: number
): Promise<PaginatedTrainingHistory> {
  // Validate student exists
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true },
  });

  if (!student) {
    throw new ServiceError('Student not found', 404);
  }

  // Get student's batch IDs
  const batchMemberships = await prisma.batchMember.findMany({
    where: { studentId },
    select: { batchId: true },
  });

  const batchIds = batchMemberships.map((m) => m.batchId);

  if (batchIds.length === 0) {
    // Student not in any batch — return empty history
    return { items: [], total: 0 };
  }

  // Build date filter
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters.from) {
    dateFilter.gte = new Date(filters.from);
  }
  if (filters.to) {
    dateFilter.lte = new Date(filters.to);
  }

  // Fetch sessions with attendance
  const sessions = await prisma.session.findMany({
    where: {
      batchId: { in: batchIds },
      ...(Object.keys(dateFilter).length > 0 ? { scheduledDate: dateFilter } : {}),
    },
    select: {
      id: true,
      title: true,
      topic: true,
      scheduledDate: true,
      attendances: {
        where: { studentId },
        select: { status: true },
      },
    },
    orderBy: { scheduledDate: 'desc' },
  });

  // Fetch assessments with results
  const assessments = await prisma.assessment.findMany({
    where: {
      batchId: { in: batchIds },
      ...(Object.keys(dateFilter).length > 0 ? { assessmentDate: dateFilter } : {}),
    },
    select: {
      id: true,
      title: true,
      type: true,
      maxScore: true,
      assessmentDate: true,
      results: {
        where: { studentId },
        select: {
          score: true,
          remarks: true,
        },
      },
    },
    orderBy: { assessmentDate: 'desc' },
  });

  // Build timeline events
  const events: TimelineEvent[] = [];

  // Add session events
  for (const session of sessions) {
    const attendanceStatus = resolveAttendanceStatus(session.attendances);

    events.push({
      type: 'SESSION',
      date: session.scheduledDate,
      session: {
        id: session.id,
        title: session.title,
        topic: session.topic,
      },
      attendance: attendanceStatus,
    });
  }

  // Add assessment events
  for (const assessment of assessments) {
    const result = assessment.results[0]; // At most one result per student per assessment

    events.push({
      type: 'ASSESSMENT',
      date: assessment.assessmentDate,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
      },
      score: result
        ? {
            obtained: result.score,
            maximum: assessment.maxScore,
            percentage: calculatePercentage(result.score, assessment.maxScore),
          }
        : null,
      remarks: result?.remarks || null,
    });
  }

  // Sort chronologically (newest first) with deterministic tie-breaker
  events.sort((a, b) => {
    const timeDiff = b.date.getTime() - a.date.getTime();
    if (timeDiff !== 0) return timeDiff;

    // Tie-breaker: SESSION before ASSESSMENT on same date
    if (a.type === 'SESSION' && b.type === 'ASSESSMENT') return -1;
    if (a.type === 'ASSESSMENT' && b.type === 'SESSION') return 1;

    // Further tie-breaker: alphabetical by title
    const aTitle = a.type === 'SESSION' ? a.session.title : a.assessment.title;
    const bTitle = b.type === 'SESSION' ? b.session.title : b.assessment.title;
    return aTitle.localeCompare(bTitle);
  });

  // Pagination
  const total = events.length;
  const skip = (page - 1) * limit;
  const paginatedEvents = events.slice(skip, skip + limit);

  return {
    items: paginatedEvents,
    total,
  };
}
