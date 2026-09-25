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
import attendanceRoutes from './routes/attendance.routes';
import feedbackRoutes from './routes/feedback.routes';
import mentorAssignmentRoutes from './routes/mentor-assignments.routes';
import riskRoutes from './routes/risk.routes';

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

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

export default app;
