/**
 * Integration tests for the intervention workflow.
 *
 * These tests verify route-level authorization, cross-record access rejection,
 * terminal-state enforcement, and scope resolution using supertest against the
 * actual Express app. They mock Prisma at the module level so no database is
 * required, but the full middleware chain (JWT auth, RBAC, validation) runs.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

// We need to mock prisma before importing the app
jest.mock('../lib/prisma', () => {
  const mockPrisma: any = {
    rolePermission: { findMany: jest.fn() },
    intervention: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    interventionUpdate: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    interventionTask: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    interventionOutcome: {
      create: jest.fn(),
      update: jest.fn(),
    },
    mentorAssignment: { findUnique: jest.fn() },
    riskScore: { findFirst: jest.fn() },
    notification: { create: jest.fn() },
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
  };
  // Make $transaction run the callback with the mock prisma
  mockPrisma.$transaction.mockImplementation(async (fn: any) => {
    if (typeof fn === 'function') return fn(mockPrisma);
    return Promise.all(fn);
  });
  return { __esModule: true, default: mockPrisma };
});

import app from '../server';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Role IDs
const ROLE_IDS = {
  STUDENT: 'role-student',
  MENTOR: 'role-mentor',
  FACULTY: 'role-faculty',
  ADMIN: 'role-admin',
  TRAINER: 'role-trainer',
  COORDINATOR: 'role-coordinator',
};

function makeToken(sub: string, roleId: string): string {
  return jwt.sign({ sub, roleId }, JWT_SECRET, { expiresIn: '1h' });
}

// Permission definitions per role for interventions
const ROLE_PERMS: Record<string, Array<{ permission: { code: string } }>> = {
  [ROLE_IDS.STUDENT]: [
    { permission: { code: 'interventions:read:own' } },
    { permission: { code: 'notifications:read:own' } },
    { permission: { code: 'notifications:update:own' } },
  ],
  [ROLE_IDS.MENTOR]: [
    { permission: { code: 'interventions:create:assigned' } },
    { permission: { code: 'interventions:update:own' } },
    { permission: { code: 'interventions:log_outcome:own' } },
    { permission: { code: 'interventions:read:assigned' } },
  ],
  [ROLE_IDS.FACULTY]: [
    { permission: { code: 'interventions:read:any' } },
  ],
  [ROLE_IDS.ADMIN]: [
    { permission: { code: 'interventions:read:any' } },
  ],
  [ROLE_IDS.TRAINER]: [],
  [ROLE_IDS.COORDINATOR]: [],
};

function setupRolePermissions() {
  (prisma.rolePermission.findMany as jest.Mock).mockImplementation(
    async ({ where }: any) => {
      const roleId = where.roleId;
      const requestedCodes: string[] = where.permission.code.in;
      const allPerms = ROLE_PERMS[roleId] || [];
      return allPerms.filter((rp) => requestedCodes.includes(rp.permission.code));
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setupRolePermissions();
});

// ── Finding 1: Read-access scope resolution ──
describe('Finding 1: resolveScope("interventions:read") authorization', () => {
  const studentToken = makeToken('student-1', ROLE_IDS.STUDENT);
  const mentorToken = makeToken('mentor-1', ROLE_IDS.MENTOR);
  const mentor2Token = makeToken('mentor-2', ROLE_IDS.MENTOR);
  const facultyToken = makeToken('faculty-1', ROLE_IDS.FACULTY);
  const adminToken = makeToken('admin-1', ROLE_IDS.ADMIN);
  const trainerToken = makeToken('trainer-1', ROLE_IDS.TRAINER);
  const coordinatorToken = makeToken('coordinator-1', ROLE_IDS.COORDINATOR);

  const sampleIntervention = {
    id: 'int-1',
    studentId: 'student-1',
    mentorId: 'mentor-1',
    status: 'PENDING',
    title: 'Test Intervention',
    description: 'desc',
    student: { id: 'student-1', name: 'Student', email: 's@t.com' },
    mentor: { id: 'mentor-1', name: 'Mentor', email: 'm@t.com' },
    tasks: [],
    updates: [],
    outcome: null,
    riskScore: null,
  };

  describe('GET /api/interventions (list)', () => {
    beforeEach(() => {
      (prisma.intervention.findMany as jest.Mock).mockResolvedValue([sampleIntervention]);
      (prisma.intervention.count as jest.Mock).mockResolvedValue(1);
    });

    it('student lists only own interventions (scope=own)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      const call = (prisma.intervention.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.studentId).toBe('student-1');
    });

    it('mentor lists only assigned interventions (scope=assigned)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${mentorToken}`);
      expect(res.status).toBe(200);
      const call = (prisma.intervention.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.mentorId).toBe('mentor-1');
    });

    it('faculty lists all interventions (scope=any)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
      const call = (prisma.intervention.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.studentId).toBeUndefined();
      expect(call.where.mentorId).toBeUndefined();
    });

    it('admin lists all interventions (scope=any)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('trainer is denied (no intervention permissions)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${trainerToken}`);
      expect(res.status).toBe(403);
    });

    it('coordinator is denied (no intervention permissions)', async () => {
      const res = await request(app)
        .get('/api/interventions')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/interventions/:id (detail)', () => {
    beforeEach(() => {
      (prisma.intervention.findUnique as jest.Mock).mockResolvedValue(sampleIntervention);
    });

    it('student can read own intervention', async () => {
      const res = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
    });

    it('student cannot read another students intervention', async () => {
      const otherStudentToken = makeToken('student-2', ROLE_IDS.STUDENT);
      const res = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(404);
    });

    it('mentor can read own assigned intervention', async () => {
      const res = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${mentorToken}`);
      expect(res.status).toBe(200);
    });

    it('another mentor cannot read intervention by changing ID', async () => {
      const res = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${mentor2Token}`);
      expect(res.status).toBe(404);
    });

    it('faculty can read any intervention', async () => {
      const res = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(res.status).toBe(200);
    });

    it('faculty cannot mutate (no update permission)', async () => {
      const res = await request(app)
        .patch('/api/interventions/int-1')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({ title: 'Hacked' });
      expect(res.status).toBe(403);
    });

    it('admin can read but not mutate', async () => {
      const readRes = await request(app)
        .get('/api/interventions/int-1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(readRes.status).toBe(200);

      const mutateRes = await request(app)
        .patch('/api/interventions/int-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Hacked' });
      expect(mutateRes.status).toBe(403);
    });
  });
});

// ── Finding 3: Terminal note restrictions ──
describe('Finding 3: Terminal note restrictions', () => {
  const mentorToken = makeToken('mentor-1', ROLE_IDS.MENTOR);

  const completedNote = {
    id: 'note-1',
    interventionId: 'int-1',
    note: 'Original note',
    intervention: { id: 'int-1', mentorId: 'mentor-1', studentId: 'student-1', status: 'COMPLETED' },
  };

  const activeNote = {
    id: 'note-2',
    interventionId: 'int-2',
    note: 'Active note',
    intervention: { id: 'int-2', mentorId: 'mentor-1', studentId: 'student-1', status: 'IN_PROGRESS' },
  };

  describe('note edit on completed intervention', () => {
    it('should reject note update on COMPLETED intervention', async () => {
      (prisma.interventionUpdate.findUnique as jest.Mock).mockResolvedValue(completedNote);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          const mockTx: any = {
            interventionUpdate: {
              findUnique: jest.fn().mockResolvedValue(completedNote),
              update: jest.fn(),
            },
          };
          return fn(mockTx);
        }
      });

      const res = await request(app)
        .patch('/api/interventions/int-1/notes/note-1')
        .set('Authorization', `Bearer ${mentorToken}`)
        .send({ note: 'Modified note' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/completed or cancelled/i);
    });
  });

  describe('note delete on completed intervention', () => {
    it('should reject note deletion on COMPLETED intervention', async () => {
      (prisma.interventionUpdate.findUnique as jest.Mock).mockResolvedValue(completedNote);
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          const mockTx: any = {
            interventionUpdate: {
              findUnique: jest.fn().mockResolvedValue(completedNote),
              delete: jest.fn(),
            },
          };
          return fn(mockTx);
        }
      });

      const res = await request(app)
        .delete('/api/interventions/int-1/notes/note-1')
        .set('Authorization', `Bearer ${mentorToken}`);

      expect(res.status).toBe(409);
    });
  });
});

// ── Finding 6: Status concurrency ──
describe('Finding 6: Terminal state enforcement', () => {
  const mentorToken = makeToken('mentor-1', ROLE_IDS.MENTOR);

  it('should return 409 when completing already-completed intervention', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        const mockTx: any = {
          intervention: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'int-1',
              status: 'COMPLETED',
              mentorId: 'mentor-1',
            }),
          },
        };
        return fn(mockTx);
      }
    });

    const res = await request(app)
      .post('/api/interventions/int-1/complete')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ outcome: 'IMPROVED' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already terminal/i);
  });

  it('should return 409 when updating cancelled intervention', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        const mockTx: any = {
          intervention: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'int-1',
              status: 'CANCELLED',
              mentorId: 'mentor-1',
            }),
          },
        };
        return fn(mockTx);
      }
    });

    const res = await request(app)
      .patch('/api/interventions/int-1')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ title: 'New Title' });

    expect(res.status).toBe(409);
  });

  it('should return 409 when adding task to completed intervention', async () => {
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => {
      if (typeof fn === 'function') {
        const mockTx: any = {
          intervention: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'int-1',
              status: 'COMPLETED',
              mentorId: 'mentor-1',
            }),
          },
        };
        return fn(mockTx);
      }
    });

    const res = await request(app)
      .post('/api/interventions/int-1/tasks')
      .set('Authorization', `Bearer ${mentorToken}`)
      .send({ title: 'New task' });

    expect(res.status).toBe(409);
  });
});

// ── Unauthenticated access ──
describe('Unauthenticated access', () => {
  it('should reject requests without token', async () => {
    const res = await request(app).get('/api/interventions');
    expect(res.status).toBe(401);
  });

  it('should reject requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
