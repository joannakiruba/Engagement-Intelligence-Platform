import express from 'express';
import { config } from './config';
import { logger } from './utils/logger';
import { closeQueues, enqueueOverdueCheck } from './jobs/queue';
import { closeEmailWorker, emailWorker } from './jobs/email.job';
import { closeMentorAlertWorker, mentorAlertWorker } from './jobs/alert.job';
import { closeWeeklyReportWorker, weeklyReportWorker } from './jobs/weekly-report.job';
import { closeOverdueCheckWorker, overdueCheckWorker } from './jobs/overdue-check.job';
import { computeWeekBounds, scheduleAllWeeklyReports } from './services/weekly-report.service';

const app = express();
app.use(express.json());

// Cloud Run IAM must restrict this service to its worker and Cloud Scheduler service accounts.
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    workers: {
      email: emailWorker.isRunning(),
      mentorAlert: mentorAlertWorker.isRunning(),
      weeklyReport: weeklyReportWorker.isRunning(),
      overdueCheck: overdueCheckWorker.isRunning(),
    },
  });
});

// Cloud Scheduler calls this endpoint with an OIDC token accepted by Cloud Run IAM.
app.post('/internal/scheduler/weekly-reports', async (_req, res, next) => {
  try {
    if (!config.weeklyReport.enabled) {
      res.json({ enabled: false, queued: 0 });
      return;
    }
    const scheduleTime = _req.header('X-CloudScheduler-ScheduleTime');
    const referenceTime = scheduleTime ? new Date(scheduleTime) : new Date();
    if (Number.isNaN(referenceTime.getTime())) {
      res.status(400).json({ error: 'Invalid Cloud Scheduler schedule time' });
      return;
    }
    const { weekStart, weekEnd } = computeWeekBounds(referenceTime, config.weeklyReport.timezone);
    const result = await scheduleAllWeeklyReports(weekStart, weekEnd);
    res.json({ enabled: true, queued: result.queued });
  } catch (error) {
    next(error);
  }
});

// Cloud Scheduler retries for the same scheduled hour resolve to the same stable queue job ID.
app.post('/internal/scheduler/overdue-check', async (_req, res, next) => {
  try {
    const scheduleTime = _req.header('X-CloudScheduler-ScheduleTime');
    const scheduledAt = scheduleTime ? new Date(scheduleTime) : new Date();
    if (Number.isNaN(scheduledAt.getTime())) {
      res.status(400).json({ error: 'Invalid Cloud Scheduler schedule time' });
      return;
    }
    const job = await enqueueOverdueCheck(scheduledAt);
    res.status(202).json({ queued: true, jobId: job.id });
  } catch (error) {
    next(error);
  }
});

const server = app.listen(config.port, () => {
  logger.info(`BullMQ worker service listening on port ${config.port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received, stopping worker service`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Worker shutdown exceeded Cloud Run termination window');
    process.exit(1);
  }, 8000);

  server.close(async () => {
    try {
      await Promise.all([
        closeEmailWorker(),
        closeMentorAlertWorker(),
        closeWeeklyReportWorker(),
        closeOverdueCheckWorker(),
      ]);
      await closeQueues();
      logger.info('All BullMQ workers and Redis connections closed');
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      logger.error('Worker shutdown failed', { error: (error as Error).message });
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
