import express from 'express';
import request from 'supertest';

const mockGetMentorAlerts = jest.fn();

jest.mock('../services/ml.service', () => ({
  generateMentorAlerts: jest.fn(),
  getMentorAlerts: (...a: any[]) => mockGetMentorAlerts(...a),
  getStudentAlerts: jest.fn(),
  updateAlertStatus: jest.fn(),
  recordAlertOutcome: jest.fn(),
  getAlertStats: jest.fn(),
}));

let currentUser = { sub: 'mentor-1', roleId: 'mentor-role' };
let currentPermissions = new Set<string>();

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => {
    _req.heldPermissions = currentPermissions;
    next();
  },
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

import mentorAlertRoutes from '../routes/mentor-alerts.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = currentUser;
    next();
  });
  app.use('/api/mentor-alerts', mentorAlertRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/mentor-alerts/mentor/:mentorId — ownership enforcement', () => {
  it('allows a mentor to see their own alerts', async () => {
    currentUser = { sub: 'mentor-1', roleId: 'mentor-role' };
    currentPermissions = new Set(['interventions:read:assigned']);
    mockGetMentorAlerts.mockResolvedValue([{ id: 1 }]);

    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-1');
    expect(res.status).toBe(200);
    expect(mockGetMentorAlerts).toHaveBeenCalledWith('mentor-1');
  });

  it('blocks a mentor from seeing another mentor\'s alerts', async () => {
    currentUser = { sub: 'mentor-1', roleId: 'mentor-role' };
    currentPermissions = new Set(['interventions:read:assigned']);

    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-2');
    expect(res.status).toBe(403);
    expect(mockGetMentorAlerts).not.toHaveBeenCalled();
  });

  it('allows admin with read:any to see any mentor\'s alerts', async () => {
    currentUser = { sub: 'admin-1', roleId: 'admin-role' };
    currentPermissions = new Set(['interventions:read:any']);
    mockGetMentorAlerts.mockResolvedValue([]);

    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-2');
    expect(res.status).toBe(200);
  });
});
