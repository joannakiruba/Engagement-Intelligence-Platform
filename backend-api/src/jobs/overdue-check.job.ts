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

    const now = new Date();
    let created = 0;
    let checked = 0;

    const overdueCandidates = await prisma.interventionTask.findMany({
      where: {
        isCompleted: false,
        deadline: { lt: now },
        intervention: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      },
      select: {
        id: true,
        title: true,
        deadline: true,
        isCompleted: true,
        intervention: {
          select: { id: true, studentId: true, title: true, status: true },
        },
      },
    });

    for (const candidate of overdueCandidates) {
      checked++;
      const dedupKey = `overdue:task:${candidate.id}:${candidate.deadline!.toISOString()}`;

      try {
        // Re-verify inside a transaction to guard against concurrent completion
        await prisma.$transaction(async (tx) => {
          const task = await tx.interventionTask.findUnique({
            where: { id: candidate.id },
            select: {
              isCompleted: true,
              deadline: true,
              intervention: { select: { status: true } },
            },
          });

          if (!task) return;
          if (task.isCompleted) return;
          if (!task.deadline || task.deadline.getTime() !== candidate.deadline!.getTime()) return;
          if (task.deadline > now) return;
          if (task.intervention.status !== 'PENDING' && task.intervention.status !== 'IN_PROGRESS') return;

          await tx.notification.create({
            data: {
              userId: candidate.intervention.studentId,
              title: 'Task Overdue',
              message: `Your task "${candidate.title}" in intervention "${candidate.intervention.title}" is past its deadline.`,
              type: 'TASK_UPDATE',
              referenceId: candidate.intervention.id,
              referenceType: 'intervention',
              deduplicationKey: dedupKey,
            },
          });
          created++;
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          continue;
        }
        logger.error('Failed to create overdue notification', {
          taskId: candidate.id,
          error: err.message,
        });
      }
    }

    logger.info(`Overdue check complete: ${checked} overdue tasks checked, ${created} new notifications created`);
    return { overdueTasks: checked, notificationsCreated: created };
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
