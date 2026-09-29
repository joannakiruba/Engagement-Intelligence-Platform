import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create Redis connection
const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
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

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    emailQueue.close(),
    mentorAlertQueue.close(),
    weeklyReportQueue.close(),
    redisConnection.quit(),
  ]);
  logger.info('All queues closed');
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
    jobId: `mentor-alert-${data.studentId}-${Date.now()}`,
  });
  logger.info('Mentor alert queued', { mentorId: data.mentorId, studentId: data.studentId });
}

export async function queueWeeklyReport(data: WeeklyReportJob): Promise<void> {
  const weekKey = `${data.weekStart.toISOString()}-${data.weekEnd.toISOString()}`;
  await weeklyReportQueue.add('weekly-report', data, {
    jobId: `weekly-report-${data.mentorId}-${weekKey}`,
  });
  logger.info('Weekly report queued', { mentorId: data.mentorId });
}
