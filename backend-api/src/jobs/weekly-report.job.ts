import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../lib/redis';
import { logger } from '../utils/logger';
import { sendWeeklyReport } from '../services/email.service';
import { generateWeeklyReportData } from '../services/weekly-report.service';
import type { WeeklyReportJob } from './queue';

const redisConnection = createRedisConnection({
  maxRetriesPerRequest: null,
});

export const weeklyReportWorker = new Worker<WeeklyReportJob>(
  'weekly-report',
  async (job: Job<WeeklyReportJob>) => {
    const { mentorId, weekStart, weekEnd } = job.data;

    logger.info('Processing weekly report job', {
      jobId: job.id,
      mentorId,
      weekStart,
      weekEnd,
    });

    try {
      const report = await generateWeeklyReportData(
        mentorId,
        new Date(weekStart),
        new Date(weekEnd),
      );

      await sendWeeklyReport({
        to: report.mentorEmail,
        mentorName: report.mentorName,
        weekStart: report.weekStart,
        weekEnd: report.weekEnd,
        students: report.students.map((s) => ({
          name: s.name,
          riskLevel: s.riskLevel,
          riskScore: s.riskScore,
          trend: s.trend,
          reasons: s.reasons,
          dataAvailability: s.dataAvailability,
        })),
      });

      logger.info('Weekly report processed successfully', {
        jobId: job.id,
        mentorId,
        studentCount: report.students.length,
      });

      return {
        success: true,
        studentCount: report.students.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process weekly report', {
        jobId: job.id,
        mentorId,
        error: (error as Error).message,
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

weeklyReportWorker.on('completed', (job) => {
  logger.info('Weekly report job completed', { jobId: job.id });
});

weeklyReportWorker.on('failed', (job, error) => {
  logger.error('Weekly report job failed', {
    jobId: job?.id,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

weeklyReportWorker.on('error', (error) => {
  logger.error('Weekly report worker error', { error: error.message });
});

export async function closeWeeklyReportWorker(): Promise<void> {
  await weeklyReportWorker.close();
  if (redisConnection.status !== 'end') await redisConnection.quit();
}

logger.info('Weekly report worker started');
