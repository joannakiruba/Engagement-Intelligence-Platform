import { Job, Queue, QueueOptions } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { logger } from '../utils/logger';

// Create Redis connection
const redisConnection = createRedisConnection({
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redisConnection.on('connect', () => {
  logger.info('Redis connected for BullMQ');
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error', { error: error.message });
});

// Queue options
const defaultQueueOptions: QueueOptions = {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 7 * 24 * 60 * 60,
    },
    removeOnFail: {
      count: 500,
      age: 14 * 24 * 60 * 60,
    },
  },
};

// Single email queue for all email types
export const emailQueue = new Queue('email', defaultQueueOptions);

// Mentor alert queue for high-priority notifications
export const mentorAlertQueue = new Queue('mentor-alert', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 1,
    attempts: 5,
  },
});

// Weekly report queue
export const weeklyReportQueue = new Queue('weekly-report', defaultQueueOptions);

logger.info('BullMQ queues initialized');

// Overdue-check queue for intervention task deadline monitoring
export const overdueCheckQueue = new Queue('overdue-check', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 20, age: 24 * 60 * 60 },
    removeOnFail: { count: 50, age: 7 * 24 * 60 * 60 },
  },
});

// ML risk-alert generation is a distinct workflow from sending alert emails.
export const mentorAlertGenerationQueue = new Queue('mentor-alert-generation', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    emailQueue.close(),
    mentorAlertQueue.close(),
    mentorAlertGenerationQueue.close(),
    weeklyReportQueue.close(),
    overdueCheckQueue.close(),
    redisConnection.quit(),
  ]);
  logger.info('All queues closed');
}

/** Enqueue at most one overdue scan per UTC hour, including Scheduler retries. */
export async function enqueueOverdueCheck(scheduledAt?: Date): Promise<Job> {
  const referenceTime = scheduledAt?.getTime() ?? Date.now();
  const hourBucket = Math.floor(referenceTime / (60 * 60 * 1000));
  return overdueCheckQueue.add('overdue-check', {}, { jobId: `overdue-check-${hourBucket}` });
}

// Job type definitions
export interface ActivationEmailJob {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export interface PasswordResetEmailJob {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export interface MentorAlertJob {
  riskScoreId?: string;
  mentorId: string;
  mentorEmail: string;
  mentorName: string;
  studentId: string;
  studentName: string;
  riskLevel: string;
  riskScore: number;
  factors?: Record<string, unknown>;
  interventionLink?: string;
}

export interface MentorAlertGenerationJob {
  batchId: string;
  triggerId: string;
}

export interface WeeklyReportJob {
  mentorId: string;
  weekStart: Date;
  weekEnd: Date;
}

// Helper functions to add jobs
export async function queueActivationEmail(data: ActivationEmailJob): Promise<void> {
  await emailQueue.add('activation-email', data, {
    jobId: `activation-${data.userId}-${Date.now()}`,
  });
  logger.info('Activation email queued', { userId: data.userId, email: data.email });
}

export async function queuePasswordResetEmail(data: PasswordResetEmailJob): Promise<void> {
  await emailQueue.add('password-reset-email', data, {
    jobId: `password-reset-${data.userId}-${Date.now()}`,
  });
  logger.info('Password reset email queued', { userId: data.userId, email: data.email });
}

export async function queueMentorAlert(data: MentorAlertJob): Promise<void> {
  await mentorAlertQueue.add('mentor-alert', data, {
    jobId: data.riskScoreId
      ? `mentor-alert-${data.riskScoreId}-${data.mentorId}`
      : `mentor-alert-${data.studentId}-${Date.now()}`,
  });
  logger.info('Mentor alert queued', { mentorId: data.mentorId, studentId: data.studentId });
}

export async function queueMentorAlertGeneration(batchId: string, triggerId: string): Promise<void> {
  await mentorAlertGenerationQueue.add('generate-mentor-alerts', { batchId, triggerId }, {
    jobId: `mentor-alert-generation-${batchId}-${triggerId}`,
  });
  logger.info('ML mentor-alert generation queued', { batchId, triggerId });
}

/** Re-enqueue the latest risk snapshot for a batch (safe because ML writes are idempotent). */
export async function requeueMentorAlertGeneration(batchId: string, triggerId: string): Promise<void> {
  await mentorAlertGenerationQueue.add('generate-mentor-alerts', { batchId, triggerId }, {
    jobId: `mentor-alert-recovery-${batchId}-${triggerId}-${Math.floor(Date.now() / 900_000)}`,
  });
}

export async function queueWeeklyReport(data: WeeklyReportJob): Promise<void> {
  const startKey = data.weekStart.toISOString().replace(/[:.]/g, '-');
  const endKey = data.weekEnd.toISOString().replace(/[:.]/g, '-');
  await weeklyReportQueue.add('weekly-report', data, {
    jobId: `weekly-report-${data.mentorId}-${startKey}-${endKey}`,
  });
  logger.info('Weekly report queued', { mentorId: data.mentorId });
}
