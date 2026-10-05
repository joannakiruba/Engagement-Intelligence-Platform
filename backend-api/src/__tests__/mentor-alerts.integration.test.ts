import express from 'express';
import request from 'supertest';

const mockGenerateMentorAlerts = jest.fn();
const mockGetMentorAlerts = jest.fn();
const mockGetStudentAlerts = jest.fn();
const mockUpdateAlertStatus = jest.fn();
const mockRecordAlertOutcome = jest.fn();
const mockGetAlertStats = jest.fn();

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/ml.service', () => ({
  generateMentorAlerts: (...a: any[]) => mockGenerateMentorAlerts(...a),
  getMentorAlerts: (...a: any[]) => mockGetMentorAlerts(...a),
  getStudentAlerts: (...a: any[]) => mockGetStudentAlerts(...a),
  updateAlertStatus: (...a: any[]) => mockUpdateAlertStatus(...a),
  recordAlertOutcome: (...a: any[]) => mockRecordAlertOutcome(...a),
  getAlertStats: (...a: any[]) => mockGetAlertStats(...a),
}));

import mentorAlertRoutes from '../routes/mentor-alerts.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: 'admin-user-id', roleId: 'admin-role-id' };
    next();
  });
  app.use('/api/mentor-alerts', mentorAlertRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  mockGenerateMentorAlerts.mockReset();
  mockGetMentorAlerts.mockReset();
  mockGetStudentAlerts.mockReset();
  mockUpdateAlertStatus.mockReset();
  mockRecordAlertOutcome.mockReset();
  mockGetAlertStats.mockReset();
});

const SAMPLE_ALERT = {
  student_id: 'stu-1',
  student_name: 'Alice',
  mentor_id: 'mentor-1',
  mentor_name: 'Dr. Smith',
  priority_score: 85,
  urgency_tier: 'CRITICAL',
  trigger_reason: 'Rapid risk increase',
  risk_score: 78,
  risk_velocity: 15,
  recommended_intervention: 'one_on_one_meeting',
  recommendation_confidence: 0.87,
  recommendation_reasoning: 'First time at high risk',
  contributing_factors: [],
  created_at: new Date().toISOString(),
};

// ─── POST /generate ───

describe('POST /api/mentor-alerts/generate', () => {
  it('generates alerts successfully', async () => {
    const result = { total_students_analyzed: 10, alerts_generated: 3, alerts_filtered: 2, alerts: [SAMPLE_ALERT] };
    mockGenerateMentorAlerts.mockResolvedValue(result);

    const res = await request(app).post('/api/mentor-alerts/generate').send({});
    expect(res.status).toBe(201);
    expect(res.body.data.alerts_generated).toBe(3);
  });

  it('accepts optional batchId', async () => {
    mockGenerateMentorAlerts.mockResolvedValue({ total_students_analyzed: 0, alerts_generated: 0, alerts_filtered: 0, alerts: [] });

    const batchId = 'a0000000-0000-0000-0000-000000000001';
    await request(app).post('/api/mentor-alerts/generate').send({ batchId });
    expect(mockGenerateMentorAlerts).toHaveBeenCalledWith(batchId);
  });

  it('rejects invalid batchId format', async () => {
    const res = await request(app).post('/api/mentor-alerts/generate').send({ batchId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 503 when ML service unavailable', async () => {
    mockGenerateMentorAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).post('/api/mentor-alerts/generate').send({});
    expect(res.status).toBe(503);
  });
});

// ─── GET /mentor/:mentorId ───

describe('GET /api/mentor-alerts/mentor/:mentorId', () => {
  it('returns alerts for a mentor', async () => {
    mockGetMentorAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mentor_id).toBe('mentor-1');
  });

  it('returns empty array when no alerts', async () => {
    mockGetMentorAlerts.mockResolvedValue([]);
    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetMentorAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-1');
    expect(res.status).toBe(503);
  });
});

// ─── GET /student/:studentId ───

describe('GET /api/mentor-alerts/student/:studentId', () => {
  it('returns alerts for a student', async () => {
    mockGetStudentAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app).get('/api/mentor-alerts/student/stu-1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetStudentAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).get('/api/mentor-alerts/student/stu-1');
    expect(res.status).toBe(503);
  });
});

// ─── PUT /:alertId/status ───

describe('PUT /api/mentor-alerts/:alertId/status', () => {
  it('updates alert status', async () => {
    mockUpdateAlertStatus.mockResolvedValue({ id: 1, alert_status: 'seen' });
    const res = await request(app).put('/api/mentor-alerts/1/status').send({ status: 'seen' });
    expect(res.status).toBe(200);
  });

  it('accepts all valid status values', async () => {
    for (const status of ['pending', 'seen', 'acted', 'dismissed']) {
      mockUpdateAlertStatus.mockResolvedValue({ id: 1, alert_status: status });
      const res = await request(app).put('/api/mentor-alerts/1/status').send({ status });
      expect(res.status).toBe(200);
    }
  });

  it('rejects invalid status value', async () => {
    const res = await request(app).put('/api/mentor-alerts/1/status').send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('rejects missing status', async () => {
    const res = await request(app).put('/api/mentor-alerts/1/status').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric alertId', async () => {
    mockUpdateAlertStatus.mockResolvedValue({});
    const res = await request(app).put('/api/mentor-alerts/abc/status').send({ status: 'seen' });
    expect(res.status).toBe(400);
  });

  it('returns 503 on ML service failure', async () => {
    mockUpdateAlertStatus.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).put('/api/mentor-alerts/1/status').send({ status: 'seen' });
    expect(res.status).toBe(503);
  });
});

// ─── POST /:alertId/outcome ───

describe('POST /api/mentor-alerts/:alertId/outcome', () => {
  const validOutcome = {
    mentor_response: 'acted',
    was_recommendation_followed: true,
  };

  it('records outcome successfully', async () => {
    mockRecordAlertOutcome.mockResolvedValue({ id: 1, mentor_response: 'acted' });
    const res = await request(app).post('/api/mentor-alerts/1/outcome').send(validOutcome);
    expect(res.status).toBe(201);
  });

  it('accepts all optional fields', async () => {
    mockRecordAlertOutcome.mockResolvedValue({ id: 1 });
    const res = await request(app).post('/api/mentor-alerts/1/outcome').send({
      ...validOutcome,
      response_time_hours: 2.5,
      intervention_id: 'a0000000-0000-0000-0000-000000000001',
      outcome_notes: 'Student responded well',
    });
    expect(res.status).toBe(201);
  });

  it('rejects invalid mentor_response', async () => {
    const res = await request(app).post('/api/mentor-alerts/1/outcome').send({
      mentor_response: 'invalid',
      was_recommendation_followed: true,
    });
    expect(res.status).toBe(400);
  });

  it('rejects missing was_recommendation_followed', async () => {
    const res = await request(app).post('/api/mentor-alerts/1/outcome').send({
      mentor_response: 'acted',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric alertId', async () => {
    mockRecordAlertOutcome.mockResolvedValue({});
    const res = await request(app).post('/api/mentor-alerts/abc/outcome').send(validOutcome);
    expect(res.status).toBe(400);
  });

  it('returns 503 on ML service failure', async () => {
    mockRecordAlertOutcome.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).post('/api/mentor-alerts/1/outcome').send(validOutcome);
    expect(res.status).toBe(503);
  });
});

// ─── GET /stats ───

describe('GET /api/mentor-alerts/stats', () => {
  it('returns alert statistics', async () => {
    const stats = {
      total_alerts: 50,
      critical_count: 10,
      high_count: 20,
      moderate_count: 20,
      avg_response_time_hours: 4.5,
      acted_rate: 0.75,
      recommendation_follow_rate: 0.6,
    };
    mockGetAlertStats.mockResolvedValue(stats);

    const res = await request(app).get('/api/mentor-alerts/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.total_alerts).toBe(50);
    expect(res.body.data.critical_count).toBe(10);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetAlertStats.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app).get('/api/mentor-alerts/stats');
    expect(res.status).toBe(503);
  });
});
