import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error.middleware';
import { generalRateLimit } from './middleware/rate-limit.middleware';
import { authenticateJwt } from './auth/jwt.middleware';
import attendanceRoutes from './routes/attendance.routes';

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

app.use('/api/attendance', authenticateJwt, attendanceRoutes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} (${config.nodeEnv})`);
  });
}

export default app;
