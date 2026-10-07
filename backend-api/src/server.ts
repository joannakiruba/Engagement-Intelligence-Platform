import path from 'path';
import { existsSync } from 'fs';
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
import engagementRoutes from './routes/engagement.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import interventionRoutes from './routes/interventions.routes';
import notificationRoutes from './routes/notifications.routes';
import weeklyReportRoutes from './routes/weekly-report.routes';
import eventRegistrationRoutes from './routes/event-registrations.routes';

const app = express();

app.set('trust proxy', 1);

if (config.isProduction && config.frontendUrls.length === 0) {
  logger.warn('FRONTEND_URL(S) not configured; cross-origin browser requests are denied until a frontend origin is added');
}

app.use(cors({
  origin: (origin, callback) => {
    // Requests without Origin are server-to-server or same-host tools; browsers
    // must match one of the explicitly configured Firebase/custom site origins.
    callback(null, !origin || config.frontendUrls.includes(origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(generalRateLimit);

// Serve the built frontend from the same origin when present. API requests remain JSON.
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist, { index: false }));
  app.use((req, res, next) => {
    const apiPath = /^\/(api(?:-docs)?|auth|health)(\/|$)/.test(req.path);
    if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !apiPath) {
      res.sendFile(path.join(frontendDist, 'index.html'));
      return;
    }
    next();
  });
}

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
app.use('/api/engagement', authenticateJwt, engagementRoutes);
app.use('/api/leaderboard', authenticateJwt, leaderboardRoutes);
app.use('/api/interventions', authenticateJwt, interventionRoutes);
app.use('/api/notifications', authenticateJwt, notificationRoutes);
app.use('/api/weekly-reports', authenticateJwt, weeklyReportRoutes);
app.use('/api/event-registrations', authenticateJwt, eventRegistrationRoutes);

app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} (${config.nodeEnv})`);
  });

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
