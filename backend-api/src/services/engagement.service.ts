import prisma from '../lib/prisma';

export class ServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

interface DateFilters {
  from?: string;
  to?: string;
}

interface StudentFilters extends DateFilters {
  batchId?: string;
}

function buildSessionDateFilter(from?: string, to?: string): Record<string, unknown> {
  if (!from && !to) return {};
  const scheduledDate: Record<string, Date> = {};
  if (from) scheduledDate.gte = new Date(from);
  if (to) scheduledDate.lte = new Date(to);
  return { scheduledDate };
}

function buildAssessmentDateFilter(from?: string, to?: string): Record<string, unknown> {
  if (!from && !to) return {};
  const assessmentDate: Record<string, Date> = {};
  if (from) assessmentDate.gte = new Date(from);
  if (to) assessmentDate.lte = new Date(to);
  return { assessmentDate };
}

function calcAttendanceSummary(records: { status: string }[]) {
  const totalRecords = records.length;
  const presentCount = records.filter(r => r.status === 'PRESENT').length;
  const lateCount = records.filter(r => r.status === 'LATE').length;
  const absentCount = records.filter(r => r.status === 'ABSENT').length;
  const excusedCount = records.filter(r => r.status === 'EXCUSED').length;
  const attendanceRate = totalRecords > 0
    ? Math.round(((presentCount + lateCount) / totalRecords) * 100)
    : 0;
  return { totalRecords, presentCount, lateCount, absentCount, excusedCount, attendanceRate };
}

function calcAssessmentPercentage(score: number, maxScore: number): number {
  return maxScore > 0 ? (score / maxScore) * 100 : 0;
}

function calcAveragePercentage(results: { score: number; maxScore: number }[]): number {
  if (results.length === 0) return 0;
  const sum = results.reduce((acc, r) => acc + calcAssessmentPercentage(r.score, r.maxScore), 0);
  return Math.round((sum / results.length) * 100) / 100;
}

function calcFeedbackAverages(feedbacks: { effortRating: number; participationRating: number }[]) {
  const count = feedbacks.length;
  if (count === 0) return { averageEffortRating: 0, averageParticipationRating: 0 };
  const sumEffort = feedbacks.reduce((acc, f) => acc + f.effortRating, 0);
  const sumParticipation = feedbacks.reduce((acc, f) => acc + f.participationRating, 0);
  return {
    averageEffortRating: Math.round((sumEffort / count) * 10) / 10,
    averageParticipationRating: Math.round((sumParticipation / count) * 10) / 10,
  };
}

export async function getDashboard(filters?: DateFilters) {
  const batches = await prisma.batch.findMany({
    include: {
      members: true,
    },
  });

  const sessionDateFilter = buildSessionDateFilter(filters?.from, filters?.to);
  const assessmentDateFilter = buildAssessmentDateFilter(filters?.from, filters?.to);

  const sessions = await prisma.session.findMany({
    where: sessionDateFilter,
    select: { id: true, batchId: true },
  });
  const sessionIds = sessions.map(s => s.id);

  const attendanceRecords = await prisma.attendance.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const assessments = await prisma.assessment.findMany({
    where: assessmentDateFilter,
    select: { id: true, batchId: true, maxScore: true },
  });
  const assessmentIds = assessments.map(a => a.id);

  const assessmentResults = await prisma.assessmentResult.findMany({
    where: assessmentIds.length > 0 ? { assessmentId: { in: assessmentIds } } : { assessmentId: '' },
    include: { assessment: { select: { maxScore: true } } },
  });

  const feedbackRecords = await prisma.feedback.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const allStudentIds = new Set(batches.flatMap(b => b.members.map(m => m.studentId)));

  const overallAttendance = calcAttendanceSummary(attendanceRecords);
  const overallAssessmentScore = calcAveragePercentage(
    assessmentResults.map(r => ({ score: r.score, maxScore: r.assessment.maxScore }))
  );
  const overallFeedback = calcFeedbackAverages(feedbackRecords);

  const batchSummaries = batches.map(batch => {
    const batchSessionIds = sessions.filter(s => s.batchId === batch.id).map(s => s.id);
    const batchAttendance = attendanceRecords.filter(a => batchSessionIds.includes(a.sessionId));
    const batchAssessmentIds = assessments.filter(a => a.batchId === batch.id).map(a => a.id);
    const batchResults = assessmentResults.filter(r => batchAssessmentIds.includes(r.assessmentId));
    const batchFeedback = feedbackRecords.filter(f => batchSessionIds.includes(f.sessionId));

    const attSummary = calcAttendanceSummary(batchAttendance);
    const assAvg = calcAveragePercentage(
      batchResults.map(r => ({ score: r.score, maxScore: r.assessment.maxScore }))
    );
    const fbAvg = calcFeedbackAverages(batchFeedback);

    return {
      batchId: batch.id,
      batchName: batch.name,
      studentCount: batch.members.length,
      attendanceRate: attSummary.attendanceRate,
      averageAssessmentScore: assAvg,
      averageEffortRating: fbAvg.averageEffortRating,
      averageParticipationRating: fbAvg.averageParticipationRating,
    };
  });

  return {
    totalStudents: allStudentIds.size,
    totalBatches: batches.length,
    totalSessions: sessions.length,
    averageAttendanceRate: overallAttendance.attendanceRate,
    averageAssessmentScore: overallAssessmentScore,
    averageEffortRating: overallFeedback.averageEffortRating,
    averageParticipationRating: overallFeedback.averageParticipationRating,
    batches: batchSummaries,
  };
}

export async function getBatchEngagement(batchId: string, filters?: DateFilters) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      members: {
        include: {
          student: { select: { id: true, name: true, email: true, department: true, year: true } },
        },
      },
    },
  });
  if (!batch) throw new ServiceError('Batch not found', 404);

  const sessionDateFilter = buildSessionDateFilter(filters?.from, filters?.to);
  const sessions = await prisma.session.findMany({
    where: { batchId, ...sessionDateFilter },
    select: { id: true },
  });
  const sessionIds = sessions.map(s => s.id);

  const assessmentDateFilter = buildAssessmentDateFilter(filters?.from, filters?.to);
  const assessments = await prisma.assessment.findMany({
    where: { batchId, ...assessmentDateFilter },
    select: { id: true, maxScore: true },
  });
  const assessmentIds = assessments.map(a => a.id);

  const attendanceRecords = await prisma.attendance.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const assessmentResults = await prisma.assessmentResult.findMany({
    where: assessmentIds.length > 0 ? { assessmentId: { in: assessmentIds } } : { assessmentId: '' },
    include: { assessment: { select: { maxScore: true } } },
  });

  const feedbackRecords = await prisma.feedback.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const attendanceSummary = calcAttendanceSummary(attendanceRecords);
  const assessmentAvg = calcAveragePercentage(
    assessmentResults.map(r => ({ score: r.score, maxScore: r.assessment.maxScore }))
  );
  const feedbackAvg = calcFeedbackAverages(feedbackRecords);

  const students = batch.members.map(member => {
    const studentAttendance = attendanceRecords.filter(a => a.studentId === member.studentId);
    const studentResults = assessmentResults.filter(r => r.studentId === member.studentId);
    const studentFeedback = feedbackRecords.filter(f => f.studentId === member.studentId);

    const attSummary = calcAttendanceSummary(studentAttendance);
    const assAvg = calcAveragePercentage(
      studentResults.map(r => ({ score: r.score, maxScore: r.assessment.maxScore }))
    );
    const fbAvg = calcFeedbackAverages(studentFeedback);

    return {
      studentId: member.studentId,
      studentName: member.student.name,
      studentEmail: member.student.email,
      attendanceRate: attSummary.attendanceRate,
      assessmentAverage: assAvg,
      effortRating: fbAvg.averageEffortRating,
      participationRating: fbAvg.averageParticipationRating,
    };
  });

  return {
    batch: { id: batch.id, name: batch.name, department: batch.department, startDate: batch.startDate },
    studentCount: batch.members.length,
    sessionCount: sessions.length,
    assessmentCount: assessments.length,
    attendance: {
      averageRate: attendanceSummary.attendanceRate,
      totalRecords: attendanceSummary.totalRecords,
      presentCount: attendanceSummary.presentCount,
      lateCount: attendanceSummary.lateCount,
      absentCount: attendanceSummary.absentCount,
      excusedCount: attendanceSummary.excusedCount,
    },
    assessments: {
      averageScore: assessmentAvg,
      averagePercentage: assessmentAvg,
      totalResults: assessmentResults.length,
    },
    feedback: {
      averageEffortRating: feedbackAvg.averageEffortRating,
      averageParticipationRating: feedbackAvg.averageParticipationRating,
      totalFeedbackCount: feedbackRecords.length,
    },
    students,
  };
}

export async function getStudentEngagement(studentId: string, filters?: StudentFilters) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, department: true, year: true },
  });
  if (!student) throw new ServiceError('Student not found', 404);

  const sessionDateFilter = buildSessionDateFilter(filters?.from, filters?.to);
  const assessmentDateFilter = buildAssessmentDateFilter(filters?.from, filters?.to);

  const attendanceWhere: Record<string, unknown> = { studentId };
  if (filters?.batchId || Object.keys(sessionDateFilter).length > 0) {
    const sessionFilter: Record<string, unknown> = { ...sessionDateFilter };
    if (filters?.batchId) sessionFilter.batchId = filters.batchId;
    attendanceWhere.session = sessionFilter;
  }

  const attendanceRecords = await prisma.attendance.findMany({ where: attendanceWhere });
  const attendanceSummary = calcAttendanceSummary(attendanceRecords);

  const assessmentResultWhere: Record<string, unknown> = { studentId };
  const assessmentFilter: Record<string, unknown> = { ...assessmentDateFilter };
  if (filters?.batchId) assessmentFilter.batchId = filters.batchId;
  if (Object.keys(assessmentFilter).length > 0) {
    assessmentResultWhere.assessment = assessmentFilter;
  }

  const assessmentResults = await prisma.assessmentResult.findMany({
    where: assessmentResultWhere,
    include: {
      assessment: {
        select: { id: true, title: true, type: true, maxScore: true, assessmentDate: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const results = assessmentResults.map(r => ({
    assessmentId: r.assessment.id,
    title: r.assessment.title,
    type: r.assessment.type,
    score: r.score,
    maxScore: r.assessment.maxScore,
    percentage: Math.round(calcAssessmentPercentage(r.score, r.assessment.maxScore) * 100) / 100,
    assessmentDate: r.assessment.assessmentDate,
  }));

  const assessmentAvg = calcAveragePercentage(
    assessmentResults.map(r => ({ score: r.score, maxScore: r.assessment.maxScore }))
  );

  const feedbackWhere: Record<string, unknown> = { studentId };
  if (filters?.batchId || Object.keys(sessionDateFilter).length > 0) {
    const sessionFilter: Record<string, unknown> = { ...sessionDateFilter };
    if (filters?.batchId) sessionFilter.batchId = filters.batchId;
    feedbackWhere.session = sessionFilter;
  }

  const feedbackRecords = await prisma.feedback.findMany({
    where: feedbackWhere,
    include: {
      session: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const feedbackAvg = calcFeedbackAverages(feedbackRecords);
  const recentFeedback = feedbackRecords.slice(0, 10).map(f => ({
    sessionId: f.session.id,
    sessionTitle: f.session.title,
    effortRating: f.effortRating,
    participationRating: f.participationRating,
    comments: f.comments,
    createdAt: f.createdAt,
  }));

  return {
    student,
    attendance: attendanceSummary,
    assessments: {
      totalAssessments: assessmentResults.length,
      averageScore: assessmentAvg,
      averagePercentage: assessmentAvg,
      results,
    },
    feedback: {
      totalFeedback: feedbackRecords.length,
      averageEffortRating: feedbackAvg.averageEffortRating,
      averageParticipationRating: feedbackAvg.averageParticipationRating,
      recentFeedback,
    },
  };
}

export async function getBatchTrends(batchId: string, filters?: DateFilters) {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { id: true, name: true },
  });
  if (!batch) throw new ServiceError('Batch not found', 404);

  const sessionDateFilter = buildSessionDateFilter(filters?.from, filters?.to);
  const sessions = await prisma.session.findMany({
    where: { batchId, ...sessionDateFilter },
    select: { id: true, title: true, scheduledDate: true },
    orderBy: { scheduledDate: 'asc' },
  });
  const sessionIds = sessions.map(s => s.id);

  const attendanceRecords = await prisma.attendance.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const attendanceTrends = sessions.map(session => {
    const sessionAttendance = attendanceRecords.filter(a => a.sessionId === session.id);
    const total = sessionAttendance.length;
    const presentCount = sessionAttendance.filter(a => a.status === 'PRESENT').length;
    const lateCount = sessionAttendance.filter(a => a.status === 'LATE').length;
    const attendanceRate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;

    return {
      sessionId: session.id,
      sessionTitle: session.title,
      scheduledDate: session.scheduledDate,
      presentCount,
      totalCount: total,
      attendanceRate,
    };
  });

  const assessmentDateFilter = buildAssessmentDateFilter(filters?.from, filters?.to);
  const assessments = await prisma.assessment.findMany({
    where: { batchId, ...assessmentDateFilter },
    select: { id: true, title: true, type: true, maxScore: true, assessmentDate: true },
    orderBy: { assessmentDate: 'asc' },
  });
  const assessmentIds = assessments.map(a => a.id);

  const assessmentResults = await prisma.assessmentResult.findMany({
    where: assessmentIds.length > 0 ? { assessmentId: { in: assessmentIds } } : { assessmentId: '' },
  });

  const assessmentTrends = assessments.map(assessment => {
    const results = assessmentResults.filter(r => r.assessmentId === assessment.id);
    const avgPercentage = results.length > 0
      ? Math.round(
          (results.reduce(
            (sum, r) => sum + calcAssessmentPercentage(r.score, assessment.maxScore),
            0
          ) / results.length) * 100
        ) / 100
      : 0;
    const avgScore = results.length > 0
      ? Math.round((results.reduce((sum, r) => sum + r.score, 0) / results.length) * 100) / 100
      : 0;

    return {
      assessmentId: assessment.id,
      title: assessment.title,
      type: assessment.type,
      assessmentDate: assessment.assessmentDate,
      averageScore: avgScore,
      maxScore: assessment.maxScore,
      averagePercentage: avgPercentage,
      resultCount: results.length,
    };
  });

  const feedbackRecords = await prisma.feedback.findMany({
    where: sessionIds.length > 0 ? { sessionId: { in: sessionIds } } : { sessionId: '' },
  });

  const feedbackTrends = sessions.map(session => {
    const sessionFeedback = feedbackRecords.filter(f => f.sessionId === session.id);
    const fbAvg = calcFeedbackAverages(sessionFeedback);

    return {
      sessionId: session.id,
      sessionTitle: session.title,
      scheduledDate: session.scheduledDate,
      averageEffortRating: fbAvg.averageEffortRating,
      averageParticipationRating: fbAvg.averageParticipationRating,
      feedbackCount: sessionFeedback.length,
    };
  });

  return {
    batch: { id: batch.id, name: batch.name },
    attendance: attendanceTrends,
    assessments: assessmentTrends,
    feedback: feedbackTrends,
  };
}
