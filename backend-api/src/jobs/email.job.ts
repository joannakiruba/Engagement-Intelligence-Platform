import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { sendActivationEmail, sendPasswordResetEmail } from '../services/email.service';
import type { ActivationEmailJob, PasswordResetEmailJob } from './queue';

const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null,
});

type EmailJobData = ActivationEmailJob | PasswordResetEmailJob;

export const emailWorker = new Worker<EmailJobData>(
  'email',
  async (job: Job<EmailJobData>) => {
    logger.info('Processing email job', {
      jobId: job.id,
      type: job.name,
      email: job.data.email
    });

    try {
      if (job.name === 'activation-email') {
        const data = job.data as ActivationEmailJob;
        await sendActivationEmail({
          to: data.email,
          name: data.name,
          token: data.token,
        });
      } else if (job.name === 'password-reset-email') {
        const data = job.data as PasswordResetEmailJob;
        await sendPasswordResetEmail({
          to: data.email,
          name: data.name,
          token: data.token,
        });
      } else {
        logger.warn('Unknown email job type', { jobName: job.name });
        return { success: false, reason: 'Unknown job type' };
      }

      logger.info('Email job processed successfully', {
        jobId: job.id,
        type: job.name
      });

      return { success: true, timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Failed to process email job', {
        jobId: job.id,
        type: job.name,
        error: (error as Error).message
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

emailWorker.on('completed', (job) => {
  logger.info('Email job completed', { jobId: job.id, type: job.name });
});

emailWorker.on('failed', (job, error) => {
  logger.error('Email job failed', {
    jobId: job?.id,
    type: job?.name,
    error: error.message,
    attempts: job?.attemptsMade
  });
});

emailWorker.on('error', (error) => {
  logger.error('Email worker error', { error: error.message });
});

logger.info('Email worker started');
