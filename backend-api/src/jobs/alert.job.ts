import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { logger } from '../utils/logger';
import { sendMentorAlert } from '../services/email.service';
import { generateMentorAlerts } from '../services/ml.service';
import prisma from '../lib/prisma';
import type { MentorAlertJob } from './queue';

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

logger.info('Mentor alert worker started');

export async function closeMentorAlertWorker(): Promise<void> {
  await mentorAlertWorker.close();
  if (redisConnection.status !== 'end') await redisConnection.quit();
}

// ML-driven smart alert pipeline (Module 14)
export async function processMentorAlertJob(job: Job): Promise<void> {
  const batchId = job.data?.batchId;
  logger.info(`Running mentor alert generation pipeline${batchId ? ` for batch ${batchId}` : ''}`);
  try {
    const result = await generateMentorAlerts(batchId);
    logger.info(`Alert pipeline complete: ${result.total_students_analyzed} analyzed, ${result.alerts_generated} alerts, ${result.alerts_filtered} filtered`);
    for (const alert of result.alerts) {
      if (!alert.mentor_id) continue;
      const urgencyEmoji = alert.urgency_tier === 'CRITICAL' ? 'CRITICAL' : alert.urgency_tier === 'HIGH' ? 'HIGH' : 'MODERATE';
      await prisma.notification.create({
        data: {
          userId: alert.mentor_id,
          title: `[${urgencyEmoji}] Risk Alert: ${alert.student_name}`,
          message: [
            `Risk Score: ${alert.risk_score.toFixed(0)} (${alert.risk_velocity >= 0 ? '+' : ''}${alert.risk_velocity.toFixed(0)} from last period)`,
            `Reason: ${alert.trigger_reason}`,
            `Suggested: ${alert.recommended_intervention.replace(/_/g, ' ')} (${(alert.recommendation_confidence * 100).toFixed(0)}% confidence)`,
            alert.recommendation_reasoning,
          ].join('\n'),
          type: 'RISK_ALERT',
        },
      });
    }
    logger.info(`Created ${result.alerts.length} notifications for mentors`);
  } catch (error) {
    logger.error('Mentor alert job failed:', error);
    throw error;
  }
}
