import { Worker, Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';

const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null,
});

export const overdueCheckQueue = new Queue('overdue-check', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 20, age: 24 * 60 * 60 },
    removeOnFail: { count: 50, age: 7 * 24 * 60 * 60 },
  },
});

export const overdueCheckWorker = new Worker(
  'overdue-check',
  async (_job: Job) => {
    logger.info('Running overdue task check');

    const overdueTasks = await prisma.interventionTask.findMany({
      where: {
        isCompleted: false,
        deadline: { lt: new Date() },
        intervention: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      },
      include: {
        intervention: {
          select: { id: true, studentId: true, title: true },
        },
      },
    });

    let created = 0;
    for (const task of overdueTasks) {
      const dedupKey = `overdue:task:${task.id}:${task.deadline!.toISOString()}`;

      try {
        await prisma.notification.create({
          data: {
            userId: task.intervention.studentId,
            title: 'Task Overdue',
            message: `Your task "${task.title}" in intervention "${task.intervention.title}" is past its deadline.`,
            type: 'TASK_UPDATE',
            referenceId: task.intervention.id,
            referenceType: 'intervention',
            deduplicationKey: dedupKey,
          },
        });
        created++;
      } catch (err: any) {
        if (err.code === 'P2002') {
          continue;
        }
        logger.error('Failed to create overdue notification', {
          taskId: task.id,
          error: err.message,
        });
      }
    }

    logger.info(`Overdue check complete: ${overdueTasks.length} overdue tasks found, ${created} new notifications created`);
    return { overdueTasks: overdueTasks.length, notificationsCreated: created };
  },
  { connection: redisConnection, concurrency: 1 },
);

overdueCheckWorker.on('completed', (job) => {
  logger.info('Overdue check job completed', { jobId: job.id });
});

overdueCheckWorker.on('failed', (job, error) => {
  logger.error('Overdue check job failed', {
    jobId: job?.id,
    error: error.message,
  });
});

export async function startOverdueSchedule(): Promise<void> {
  await overdueCheckQueue.upsertJobScheduler(
    'overdue-check-scheduler',
    { every: 60 * 60 * 1000 },
    { name: 'overdue-check' },
  );
  logger.info('Overdue check scheduled: every 60 minutes');
}
