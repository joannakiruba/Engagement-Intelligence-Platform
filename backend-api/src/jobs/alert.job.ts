import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { logger } from '../utils/logger';
import { sendMentorAlert } from '../services/email.service';
import { generateMentorAlerts } from '../services/ml.service';
import prisma from '../lib/prisma';
import type { MentorAlertGenerationJob, MentorAlertJob } from './queue';

const redisConnection = createRedisConnection({
  maxRetriesPerRequest: null,
});

export const mentorAlertWorker = new Worker<MentorAlertJob>(
  'mentor-alert',
  async (job: Job<MentorAlertJob>) => {
    const { mentorEmail, mentorName, studentName, riskLevel, riskScore, factors, interventionLink } = job.data;

    logger.info('Processing mentor alert job', {
      jobId: job.id,
      mentorId: job.data.mentorId,
      studentId: job.data.studentId
    });

    try {
      await sendMentorAlert({
        to: mentorEmail,
        mentorName,
        studentName,
        riskLevel,
        riskScore,
        factors,
        interventionLink,
      });

      logger.info('Mentor alert processed successfully', {
        jobId: job.id,
        studentName,
        riskLevel
      });

      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to process mentor alert', {
        jobId: job.id,
        error: (error as Error).message
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

const alertGenerationConnection = createRedisConnection({ maxRetriesPerRequest: null });

export const mentorAlertGenerationWorker = new Worker<MentorAlertGenerationJob>(
  'mentor-alert-generation',
  async (job: Job<MentorAlertGenerationJob>) => processMentorAlertJob(job),
  { connection: alertGenerationConnection, concurrency: 2 },
);

mentorAlertWorker.on('completed', (job) => {
  logger.info('Mentor alert job completed', { jobId: job.id });
});

mentorAlertWorker.on('failed', (job, error) => {
  logger.error('Mentor alert job failed', {
    jobId: job?.id,
    error: error.message,
    attempts: job?.attemptsMade
  });
});

mentorAlertWorker.on('error', (error) => {
  logger.error('Mentor alert worker error', { error: error.message });
});

mentorAlertGenerationWorker.on('failed', (job, error) => {
  logger.error('ML mentor-alert generation job failed', {
    jobId: job?.id,
    batchId: job?.data.batchId,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

mentorAlertGenerationWorker.on('error', (error) => {
  logger.error('ML mentor-alert generation worker error', { error: error.message });
});

logger.info('Mentor alert worker started');

export async function closeMentorAlertWorker(): Promise<void> {
  await Promise.all([mentorAlertWorker.close(), mentorAlertGenerationWorker.close()]);
  await Promise.all([
    redisConnection.status !== 'end' ? redisConnection.quit() : Promise.resolve(),
    alertGenerationConnection.status !== 'end' ? alertGenerationConnection.quit() : Promise.resolve(),
  ]);
}

// ML-driven smart alert pipeline (Module 14)
export async function processMentorAlertJob(job: Job): Promise<void> {
  const batchId = job.data?.batchId;
  logger.info(`Running mentor alert generation pipeline${batchId ? ` for batch ${batchId}` : ''}`);
  try {
    const result = await generateMentorAlerts(batchId);
    logger.info(`Alert pipeline complete: ${result.total_students_analyzed} analyzed, ${result.alerts_generated} alerts, ${result.alerts_filtered} filtered`);
    const notifications = [];
    for (const alert of result.alerts) {
      if (!alert.mentor_id || !alert.id) continue;
      const urgencyEmoji = alert.urgency_tier === 'CRITICAL' ? 'CRITICAL' : alert.urgency_tier === 'HIGH' ? 'HIGH' : 'MODERATE';
      notifications.push({
          userId: alert.mentor_id,
          title: `[${urgencyEmoji}] Risk Alert: ${alert.student_name}`,
          message: [
            `Risk Score: ${alert.risk_score.toFixed(0)} (${alert.risk_velocity >= 0 ? '+' : ''}${alert.risk_velocity.toFixed(0)} from last period)`,
            `Reason: ${alert.trigger_reason}`,
            `Suggested: ${alert.recommended_intervention.replace(/_/g, ' ')} (${(alert.recommendation_confidence * 100).toFixed(0)}% confidence)`,
            alert.recommendation_reasoning,
          ].join('\n'),
          type: 'RISK_ALERT' as const,
          referenceId: String(alert.id),
          referenceType: 'mentor_alert',
          deduplicationKey: `mentor-alert-${alert.id}`,
      });
    }
    if (notifications.length) {
      await prisma.notification.createMany({ data: notifications, skipDuplicates: true });
    }
    logger.info(`Created ${result.alerts.length} notifications for mentors`);
  } catch (error) {
    logger.error('Mentor alert job failed:', error);
    throw error;
  }
}
