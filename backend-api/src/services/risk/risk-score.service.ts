import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { buildFeatures } from './feature-builder';
import { calculateRisk } from './rule-engine';
import { makeHybridDecision, MlResult } from './hybrid-decision';
import { getMlPrediction } from '../ml.service';

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

async function queueHighRiskMentorEmails(input: {
  studentId: string;
  studentName: string;
  batchId: string;
  riskScoreId: string;
  riskScore: number;
  factors: Record<string, unknown>;
}) {
  const { studentId, studentName, batchId, riskScoreId, riskScore, factors } = input;
  try {
    const assignments = await prisma.mentorAssignment.findMany({
      where: { studentId },
      select: { mentor: { select: { id: true, name: true, email: true } } },
    });
    const recipients = assignments.filter(({ mentor }) => Boolean(mentor.email));
    if (!recipients.length) {
      logger.warn('High-risk score saved but student has no assigned mentors with email addresses', {
        event: 'risk.mentor_email_no_recipients',
        studentId,
        batchId,
        riskScoreId,
      });
      return;
    }

    const { queueMentorAlert } = await import('../../jobs/queue.js');
    const frontendUrl = process.env.FRONTEND_URL?.trim();
    let interventionLink: string | undefined;
    if (frontendUrl) {
      try {
        interventionLink = new URL('/mentor-alerts', frontendUrl).toString();
      } catch {
        logger.warn('FRONTEND_URL is invalid; mentor alert email will omit the intervention link', {
          event: 'risk.mentor_email_invalid_frontend_url',
        });
      }
    }

    await Promise.all(recipients.map(({ mentor }) => queueMentorAlert({
      riskScoreId,
      mentorId: mentor.id,
      mentorEmail: mentor.email,
      mentorName: mentor.name,
      studentId,
      studentName,
      riskLevel: 'HIGH',
      riskScore,
      factors,
      interventionLink,
    })));
  } catch (error) {
    logger.error('High-risk score saved but mentor email alerts could not be queued', {
      event: 'risk.mentor_email_enqueue_failed',
      studentId,
      batchId,
      riskScoreId,
      error: (error as Error).message,
    });
  }
}

export async function calculateStudentRisk(studentId: string, batchId: string, enqueueAlerts = true) {
  const start = Date.now();

  const membership = await prisma.batchMember.findUnique({
    where: { batchId_studentId: { batchId, studentId } },
  });

  if (!membership) {
    throw new ServiceError('Student is not a member of the specified batch', 404);
  }

  const features = await buildFeatures(studentId, batchId);
  const ruleResult = calculateRisk(features);
  const mlResult = await getMlPrediction(features);
  const hybrid = makeHybridDecision(ruleResult.riskLevel, mlResult);

  const factors = {
    dataAvailability: features.dataAvailability,
    scope: { batchId },
    ruleBased: {
      attendanceRisk: ruleResult.attendanceRisk,
      assessmentRisk: ruleResult.assessmentRisk,
      feedbackRisk: ruleResult.feedbackRisk,
      totalScore: ruleResult.totalScore,
      riskLevel: ruleResult.riskLevel,
      details: ruleResult.details,
    },
    ml: JSON.parse(JSON.stringify(hybrid.ml)),
    final: {
      riskLevel: hybrid.riskLevel,
      decidedBy: hybrid.decidedBy,
    },
  };

  const riskScore = await prisma.riskScore.create({
    data: {
      studentId,
      attendanceRisk: ruleResult.attendanceRisk,
      assessmentRisk: ruleResult.assessmentRisk,
      feedbackRisk: ruleResult.feedbackRisk,
      totalScore: ruleResult.totalScore,
      riskLevel: hybrid.riskLevel,
      factors: JSON.parse(JSON.stringify(factors)),
    },
  });

  // Queue the independent email and intervention workflows concurrently after
  // persistence. Failures are isolated so neither queue blocks risk scoring.
  const downstreamTasks: Promise<void>[] = [];
  if (hybrid.riskLevel === 'HIGH') {
    downstreamTasks.push((async () => {
      const student = await prisma.user.findUnique({ where: { id: studentId }, select: { name: true } });
      if (!student) {
        logger.error('High-risk score saved but student record is missing for mentor email alert', {
          event: 'risk.mentor_email_student_missing', studentId, batchId, riskScoreId: riskScore.id,
        });
        return;
      }
      await queueHighRiskMentorEmails({
        studentId,
        studentName: student.name,
        batchId,
        riskScoreId: riskScore.id,
        riskScore: ruleResult.totalScore,
        factors: {
          attendanceRisk: ruleResult.attendanceRisk,
          assessmentRisk: ruleResult.assessmentRisk,
          feedbackRisk: ruleResult.feedbackRisk,
          finalRiskLevel: hybrid.riskLevel,
          decidedBy: hybrid.decidedBy,
        },
      });
    })());
  }
  if (enqueueAlerts) {
    downstreamTasks.push((async () => {
      try {
        const { queueMentorAlertGeneration } = await import('../../jobs/queue.js');
        await queueMentorAlertGeneration(batchId, riskScore.id);
      } catch (error) {
        // Risk scoring is still useful if the queue is temporarily unavailable.
        logger.error('Risk score saved but ML mentor-alert generation could not be queued', {
          event: 'risk.alert_enqueue_failed', studentId, batchId, riskScoreId: riskScore.id,
          error: (error as Error).message,
        });
      }
    })());
  }
  await Promise.all(downstreamTasks);

  const duration = Date.now() - start;
  logger.info('Risk calculated', {
    event: 'risk.calculated',
    studentId,
    batchId,
    duration,
    ruleScore: ruleResult.totalScore,
    ruleLevel: ruleResult.riskLevel,
    mlStatus: mlResult.status,
    mlFallbackReason: null,
    finalLevel: hybrid.riskLevel,
    decidedBy: hybrid.decidedBy,
  });

  return riskScore;
}

export async function calculateBatchRisk(batchId: string) {
  const start = Date.now();

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError('Batch not found', 404);
  }

  const members = await prisma.batchMember.findMany({
    where: { batchId },
    select: { studentId: true },
  });

  const results: { studentId: string; riskScore: any }[] = [];
  const errors: { studentId: string; error: string }[] = [];

  for (const member of members) {
    try {
      const riskScore = await calculateStudentRisk(member.studentId, batchId, false);
      results.push({ studentId: member.studentId, riskScore });
    } catch (err: any) {
      errors.push({
        studentId: member.studentId,
        error: err.message || 'Unexpected error during risk calculation',
      });
    }
  }

  const triggerId = results.at(-1)?.riskScore.id;
  if (triggerId) {
    try {
      const { queueMentorAlertGeneration } = await import('../../jobs/queue.js');
      await queueMentorAlertGeneration(batchId, triggerId);
    } catch (error) {
      logger.error('Batch risk scores saved but ML mentor-alert generation could not be queued', {
        event: 'risk.batch_alert_enqueue_failed',
        batchId,
        triggerId,
        error: (error as Error).message,
      });
    }
  }

  const duration = Date.now() - start;
  logger.info('Batch risk calculation complete', {
    event: 'risk.batch_complete',
    batchId,
    processed: members.length,
    succeeded: results.length,
    failed: errors.length,
    duration,
  });

  return {
    batchId,
    processed: members.length,
    succeeded: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

export async function getLatestRiskScore(studentId: string) {
  return prisma.riskScore.findFirst({
    where: { studentId },
    orderBy: { generatedAt: 'desc' },
  });
}

export async function getRiskHistory(studentId: string) {
  return prisma.riskScore.findMany({
    where: { studentId },
    orderBy: { generatedAt: 'desc' },
  });
}

export async function getHighRiskStudents() {
  return prisma.riskScore.findMany({
    where: { riskLevel: 'HIGH' },
    distinct: ['studentId'],
    orderBy: { generatedAt: 'desc' },
  });
}
