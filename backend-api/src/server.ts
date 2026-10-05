import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger/swagger.json';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { generalRateLimit } from './middleware/rate-limit.middleware';
import { authenticateJwt } from './auth/jwt.middleware';
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import assessmentRoutes from './routes/assessments.routes';
import batchRoutes from './routes/batches.routes';
import sessionRoutes from './routes/sessions.routes';
import { closeEmailTransporter } from './services/email.service';
import attendanceRoutes from './routes/attendance.routes';
import feedbackRoutes from './routes/feedback.routes';
import mentorAssignmentRoutes from './routes/mentor-assignments.routes';
import riskRoutes from './routes/risk.routes';
import mentorAlertRoutes from './routes/mentor-alerts.routes';
import taskRoutes from './routes/tasks.routes';
import proofRoutes from './routes/proofs.routes';
import eventRoutes from './routes/events.routes';

const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(generalRateLimit);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/auth', authRoutes);
app.use('/users', usersRoutes);
app.use('/admin/users', usersRoutes);
app.use('/api/assessments', authenticateJwt, assessmentRoutes);
app.use('/api/batches', authenticateJwt, batchRoutes);
app.use('/api/sessions', authenticateJwt, sessionRoutes);
app.use('/api/attendance', authenticateJwt, attendanceRoutes);
app.use('/api/feedback', authenticateJwt, feedbackRoutes);
app.use('/api/mentor-assignments', authenticateJwt, mentorAssignmentRoutes);
app.use('/api/risk', authenticateJwt, riskRoutes);
app.use('/api/mentor-alerts', authenticateJwt, mentorAlertRoutes);
app.use('/api/tasks', authenticateJwt, taskRoutes);
app.use('/api/events', authenticateJwt, eventRoutes);
app.use('/api/proofs', authenticateJwt, proofRoutes);

app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} (${config.nodeEnv})`);
  });

  // Start BullMQ workers in background — non-blocking, server works without Redis
  Promise.all([
    import('./jobs/email.job.js'),
    import('./jobs/alert.job.js'),
    import('./jobs/weekly-report.job.js'),
  ])
    .then(() => logger.info('BullMQ workers initialized'))
    .catch((err) => logger.warn('BullMQ workers failed to start (Redis may be unavailable)', { error: (err as Error).message }));

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        const { closeQueues } = await import('./jobs/queue.js');
        await closeQueues();
      } catch { /* Redis may not be available */ }

      try {
        await closeEmailTransporter();
      } catch { /* ignore */ }

      logger.info('All services closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
