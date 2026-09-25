import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sendMentorAlert } from '../services/email.service';
import type { MentorAlertJob } from './queue';

const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
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
