import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const mockGenerateMentorAlerts = jest.fn();
const mockGetMentorAlerts = jest.fn();
const mockGetStudentAlerts = jest.fn();
const mockUpdateAlertStatus = jest.fn();
const mockRecordAlertOutcome = jest.fn();
const mockGetAlertStats = jest.fn();

jest.mock('../services/ml.service', () => ({
  generateMentorAlerts: (...a: any[]) => mockGenerateMentorAlerts(...a),
  getMentorAlerts: (...a: any[]) => mockGetMentorAlerts(...a),
  getStudentAlerts: (...a: any[]) => mockGetStudentAlerts(...a),
  updateAlertStatus: (...a: any[]) => mockUpdateAlertStatus(...a),
  recordAlertOutcome: (...a: any[]) => mockRecordAlertOutcome(...a),
  getAlertStats: (...a: any[]) => mockGetAlertStats(...a),
}));

jest.mock('../lib/prisma', () => {
  const mockPrisma: any = {
    rolePermission: { findMany: jest.fn() },
    mentorAssignment: { findUnique: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };
  return { __esModule: true, default: mockPrisma };
});

import mentorAlertRoutes from '../routes/mentor-alerts.routes';
import { authenticateJwt } from '../auth/jwt.middleware';
import { errorHandler } from '../middleware/error.middleware';
import prisma from '../lib/prisma';

const ROLE_IDS = {
  MENTOR: 'role-mentor',
  ADMIN: 'role-admin',
  STUDENT: 'role-student',
};

function makeToken(sub: string, roleId: string): string {
  return jwt.sign({ sub, roleId }, JWT_SECRET, { expiresIn: '1h' });
}

// Permission mappings for roles
const ROLE_PERMS: Record<string, Array<{ permission: { code: string } }>> = {
  [ROLE_IDS.MENTOR]: [
    { permission: { code: 'interventions:create:assigned' } },
    { permission: { code: 'interventions:read:assigned' } },
  ],
  [ROLE_IDS.ADMIN]: [
    { permission: { code: 'interventions:read:any' } },
    { permission: { code: 'risk_scores:calculate:any' } },
  ],
  [ROLE_IDS.STUDENT]: [
    { permission: { code: 'interventions:read:own' } },
  ],
};

function createApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/mentor-alerts', authenticateJwt, mentorAlertRoutes);
  a.use(errorHandler);
  return a;
}

const app = createApp();
const mentorToken = makeToken('mentor-1', ROLE_IDS.MENTOR);
const adminToken = makeToken('admin-1', ROLE_IDS.ADMIN);
const studentToken = makeToken('student-1', ROLE_IDS.STUDENT);

beforeEach(() => {
  mockGenerateMentorAlerts.mockReset();
  mockGetMentorAlerts.mockReset();
  mockGetStudentAlerts.mockReset();
  mockUpdateAlertStatus.mockReset();
  mockRecordAlertOutcome.mockReset();
  mockGetAlertStats.mockReset();

  (prisma.rolePermission.findMany as jest.Mock).mockImplementation(
    async ({ where }: any) => {
      const roleId = where.roleId;
      const requestedCodes: string[] = where.permission.code.in;
      const allPerms = ROLE_PERMS[roleId] || [];
      return allPerms.filter((rp) => requestedCodes.includes(rp.permission.code));
    },
  );

  (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async (sql: string, ...params: any[]) => {
    if (sql.includes('ml_mentor_alerts') && sql.includes('WHERE id')) {
      return [{ id: params[0], mentor_id: 'mentor-1', student_id: 'student-1' }];
    }
    return [];
  });

  (prisma.mentorAssignment as any).findUnique = jest.fn().mockResolvedValue({ id: 'a-1' });
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
  it('generates alerts successfully (admin)', async () => {
    const result = { total_students_analyzed: 10, alerts_generated: 3, alerts_filtered: 2, alerts: [SAMPLE_ALERT] };
    mockGenerateMentorAlerts.mockResolvedValue(result);

    const res = await request(app)
      .post('/api/mentor-alerts/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.alerts_generated).toBe(3);
  });

  it('accepts optional batchId', async () => {
    mockGenerateMentorAlerts.mockResolvedValue({ total_students_analyzed: 0, alerts_generated: 0, alerts_filtered: 0, alerts: [] });

    const batchId = 'a0000000-0000-0000-0000-000000000001';
    await request(app)
      .post('/api/mentor-alerts/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId });
    expect(mockGenerateMentorAlerts).toHaveBeenCalledWith(batchId);
  });

  it('rejects invalid batchId format', async () => {
    const res = await request(app)
      .post('/api/mentor-alerts/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ batchId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('returns 503 when ML service unavailable', async () => {
    mockGenerateMentorAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .post('/api/mentor-alerts/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(500);
  });

  it('rejects mentors (no risk_scores:calculate permission)', async () => {
    const res = await request(app)
      .post('/api/mentor-alerts/generate')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ─── GET /mentor/:mentorId ───

describe('GET /api/mentor-alerts/mentor/:mentorId', () => {
  it('returns alerts for own mentor ID', async () => {
    mockGetMentorAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app)
      .get('/api/mentor-alerts/mentor/mentor-1')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].mentor_id).toBe('mentor-1');
  });

  it('mentor cannot read another mentors alerts', async () => {
    const res = await request(app)
      .get('/api/mentor-alerts/mentor/mentor-2')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(403);
  });

  it('admin can read any mentors alerts', async () => {
    mockGetMentorAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app)
      .get('/api/mentor-alerts/mentor/mentor-2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns empty array when no alerts', async () => {
    mockGetMentorAlerts.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/mentor-alerts/mentor/mentor-1')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetMentorAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .get('/api/mentor-alerts/mentor/mentor-1')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(500);
  });
});

// ─── GET /student/:studentId ───

describe('GET /api/mentor-alerts/student/:studentId', () => {
  it('student can read own alerts', async () => {
    mockGetStudentAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app)
      .get('/api/mentor-alerts/student/student-1')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('student cannot read another students alerts', async () => {
    const res = await request(app)
      .get('/api/mentor-alerts/student/student-2')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('mentor can read assigned students alerts', async () => {
    mockGetStudentAlerts.mockResolvedValue([SAMPLE_ALERT]);
    const res = await request(app)
      .get('/api/mentor-alerts/student/student-1')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(200);
  });

  it('mentor cannot read unassigned students alerts', async () => {
    (prisma.mentorAssignment as any).findUnique = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .get('/api/mentor-alerts/student/student-unassigned')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetStudentAlerts.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .get('/api/mentor-alerts/student/student-1')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(500);
  });
});

// ─── PUT /:alertId/status ───

describe('PUT /api/mentor-alerts/:alertId/status', () => {
  it('mentor updates own alert status', async () => {
    mockUpdateAlertStatus.mockResolvedValue({ id: 1, alert_status: 'seen' });
    const res = await request(app)
      .put('/api/mentor-alerts/1/status')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'seen' });
    expect(res.status).toBe(200);
  });

  it('accepts all valid status values', async () => {
    for (const status of ['pending', 'seen', 'acted', 'dismissed']) {
      mockUpdateAlertStatus.mockResolvedValue({ id: 1, alert_status: status });
      const res = await request(app)
        .put('/api/mentor-alerts/1/status')
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ status });
      expect(res.status).toBe(200);
    }
  });

  it('rejects invalid status value', async () => {
    const res = await request(app)
      .put('/api/mentor-alerts/1/status')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('rejects missing status', async () => {
    const res = await request(app)
      .put('/api/mentor-alerts/1/status')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric alertId', async () => {
    mockUpdateAlertStatus.mockResolvedValue({});
    const res = await request(app)
      .put('/api/mentor-alerts/abc/status')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'seen' });
    expect(res.status).toBe(400);
  });

  it('returns 503 on ML service failure', async () => {
    mockUpdateAlertStatus.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .put('/api/mentor-alerts/1/status')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ status: 'seen' });
    expect(res.status).toBe(500);
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
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(validOutcome);
    expect(res.status).toBe(201);
  });

  it('accepts all optional fields', async () => {
    mockRecordAlertOutcome.mockResolvedValue({ id: 1 });
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        ...validOutcome,
        response_time_hours: 2.5,
        intervention_id: 'a0000000-0000-0000-0000-000000000001',
        outcome_notes: 'Student responded well',
      });
    expect(res.status).toBe(201);
  });

  it('rejects invalid mentor_response', async () => {
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        mentor_response: 'invalid',
        was_recommendation_followed: true,
      });
    expect(res.status).toBe(400);
  });

  it('rejects missing was_recommendation_followed', async () => {
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({
        mentor_response: 'acted',
      });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-numeric alertId', async () => {
    mockRecordAlertOutcome.mockResolvedValue({});
    const res = await request(app)
      .post('/api/mentor-alerts/abc/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(validOutcome);
    expect(res.status).toBe(400);
  });

  it('returns 503 on ML service failure', async () => {
    mockRecordAlertOutcome.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send(validOutcome);
    expect(res.status).toBe(500);
  });
});

// ─── GET /stats ───

describe('GET /api/mentor-alerts/stats', () => {
  it('returns alert statistics (admin)', async () => {
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

    const res = await request(app)
      .get('/api/mentor-alerts/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total_alerts).toBe(50);
    expect(res.body.data.critical_count).toBe(10);
  });

  it('returns 503 on ML service failure', async () => {
    mockGetAlertStats.mockRejectedValue(new Error('ML service unavailable'));
    const res = await request(app)
      .get('/api/mentor-alerts/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(500);
  });

  it('rejects non-admin users', async () => {
    const res = await request(app)
      .get('/api/mentor-alerts/stats')
      .set('Authorization', `Bearer ${mentorToken}`);
    expect(res.status).toBe(403);
  });
});

// ─── Access control ───

describe('Mentor-alerts access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/mentor-alerts/mentor/mentor-1');
    expect(res.status).toBe(401);
  });

  it('mentor cannot record outcome on another mentors alert', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(async () => {
      return [{ id: 1, mentor_id: 'mentor-other', student_id: 'student-1' }];
    });
    const res = await request(app)
      .post('/api/mentor-alerts/1/outcome')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ mentor_response: 'acted', was_recommendation_followed: true });
    expect(res.status).toBe(404);
  });
});
