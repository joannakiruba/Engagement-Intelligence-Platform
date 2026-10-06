import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import {
  leaderboardBatchParamsSchema,
} from '../validators/leaderboard.validator';
import { getLeaderboardHandler } from '../controllers/leaderboard.controller';

const router = Router();

router.get(
  '/batch/:batchId',
  validate(leaderboardBatchParamsSchema, 'params'),
  getLeaderboardHandler,
);

export default router;
