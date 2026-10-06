import express from 'express';
import request from 'supertest';

const ADMIN_ID = 'a0000000-0000-0000-0000-000000000001';
const ADMIN_ROLE_ID = 'a0000000-0000-0000-0000-000000000010';
const USER_ID = 'b0000000-0000-0000-0000-000000000002';
const STUDENT_ROLE_ID = 'c0000000-0000-0000-0000-000000000003';
const TRAINER_ROLE_ID = 'd0000000-0000-0000-0000-000000000004';

const fns = {
  userFindUnique: jest.fn(),
  userFindMany: jest.fn(),
  userCreate: jest.fn(),
  userUpdate: jest.fn(),
  userCount: jest.fn(),
  roleFindUnique: jest.fn(),
  roleFindMany: jest.fn(),
  auditLogCreate: jest.fn(),
  refreshTokenUpdateMany: jest.fn(),
  activationTokenCreate: jest.fn(),
  activationTokenUpdateMany: jest.fn(),
  resetTokenCreate: jest.fn(),
  resetTokenUpdateMany: jest.fn(),
  $transaction: jest.fn(),
};

jest.mock('../auth/jwt.middleware', () => ({
  authenticateJwt: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  resolveScope: () => (_req: any, _res: any, next: any) => next(),
  enforceScopeForUser: () => Promise.resolve(true),
  getScopedStudentIds: () => Promise.resolve('all'),
}));

jest.mock('../utils/token', () => ({
  generateRawToken: () => 'mock-raw-token',
  hashToken: () => 'mock-hash',
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...a: any[]) => fns.userFindUnique(...a),
      findMany: (...a: any[]) => fns.userFindMany(...a),
      create: (...a: any[]) => fns.userCreate(...a),
      update: (...a: any[]) => fns.userUpdate(...a),
      count: (...a: any[]) => fns.userCount(...a),
    },
    role: {
      findUnique: (...a: any[]) => fns.roleFindUnique(...a),
      findMany: (...a: any[]) => fns.roleFindMany(...a),
    },
    auditLog: {
      create: (...a: any[]) => fns.auditLogCreate(...a),
    },
    refreshToken: {
      updateMany: (...a: any[]) => fns.refreshTokenUpdateMany(...a),
    },
    accountActivationToken: {
      create: (...a: any[]) => fns.activationTokenCreate(...a),
      updateMany: (...a: any[]) => fns.activationTokenUpdateMany(...a),
    },
    passwordResetToken: {
      create: (...a: any[]) => fns.resetTokenCreate(...a),
      updateMany: (...a: any[]) => fns.resetTokenUpdateMany(...a),
    },
    $transaction: (...a: any[]) => fns.$transaction(...a),
  },
}));

jest.mock('../jobs/queue.js', () => ({
  queueActivationEmail: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

import usersRoutes from '../routes/users.routes';
import { errorHandler } from '../middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { sub: ADMIN_ID, roleId: ADMIN_ROLE_ID };
    next();
  });
  app.use('/users', usersRoutes);
  app.use('/admin/users', usersRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(fns).forEach((fn) => fn.mockReset());
  // Default: requireActiveUser check passes
  fns.userFindUnique.mockImplementation(({ where }: any) => {
    if (where.id === ADMIN_ID) {
      return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
    }
    return Promise.resolve(null);
  });
});

const SAMPLE_USER = {
  id: USER_ID,
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  department: 'CS',
  year: 2,
  status: 'ACTIVE',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  role: { id: STUDENT_ROLE_ID, name: 'STUDENT' },
};

// ─── GET /users/me ───

describe('GET /users/me', () => {
  it('returns own profile', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return Promise.resolve({
          id: ADMIN_ID, name: 'Admin', email: 'admin@test.com',
          phone: null, department: null, year: null,
          status: 'ACTIVE', roleId: ADMIN_ROLE_ID,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          role: { id: ADMIN_ROLE_ID, name: 'ADMIN' },
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).get('/users/me');
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('admin@test.com');
  });
});

// ─── PATCH /users/me ───

describe('PATCH /users/me', () => {
  it('updates own name', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return Promise.resolve({
          id: ADMIN_ID, name: 'Old Name', email: 'admin@test.com',
          phone: null, status: 'ACTIVE', roleId: ADMIN_ROLE_ID,
        });
      }
      return Promise.resolve(null);
    });

    fns.$transaction.mockResolvedValue([
      { ...SAMPLE_USER, id: ADMIN_ID, name: 'New Name', email: 'admin@test.com', role: { id: ADMIN_ROLE_ID, name: 'ADMIN' } },
      {},
    ]);

    const res = await request(app).patch('/users/me').send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('rejects empty body', async () => {
    const res = await request(app).patch('/users/me').send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /users/roles ───

describe('GET /users/roles', () => {
  it('returns list of roles', async () => {
    fns.roleFindMany.mockResolvedValue([
      { id: ADMIN_ROLE_ID, name: 'ADMIN' },
      { id: STUDENT_ROLE_ID, name: 'STUDENT' },
    ]);

    const res = await request(app).get('/users/roles');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });
});

// ─── GET /users (list with pagination & filters) ───

describe('GET /users', () => {
  it('returns paginated user list', async () => {
    fns.userFindMany.mockResolvedValue([SAMPLE_USER]);
    fns.userCount.mockResolvedValue(1);

    const res = await request(app).get('/users?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(10);
  });

  it('supports search filter', async () => {
    fns.userFindMany.mockResolvedValue([]);
    fns.userCount.mockResolvedValue(0);

    const res = await request(app).get('/users?search=test');
    expect(res.status).toBe(200);
    expect(fns.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'test', mode: 'insensitive' } }),
          ]),
        }),
      }),
    );
  });

  it('supports role filter', async () => {
    fns.userFindMany.mockResolvedValue([]);
    fns.userCount.mockResolvedValue(0);

    const res = await request(app).get(`/users?roleId=${STUDENT_ROLE_ID}`);
    expect(res.status).toBe(200);
    expect(fns.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ roleId: STUDENT_ROLE_ID }),
      }),
    );
  });

  it('supports status filter', async () => {
    fns.userFindMany.mockResolvedValue([]);
    fns.userCount.mockResolvedValue(0);

    const res = await request(app).get('/users?status=ACTIVE');
    expect(res.status).toBe(200);
  });

  it('rejects invalid status', async () => {
    const res = await request(app).get('/users?status=BOGUS');
    expect(res.status).toBe(400);
  });

  it('supports department filter', async () => {
    fns.userFindMany.mockResolvedValue([]);
    fns.userCount.mockResolvedValue(0);

    const res = await request(app).get('/users?department=CS');
    expect(res.status).toBe(200);
    expect(fns.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ department: { contains: 'CS', mode: 'insensitive' } }),
      }),
    );
  });

  it('defaults to page 1 and limit 20', async () => {
    fns.userFindMany.mockResolvedValue([]);
    fns.userCount.mockResolvedValue(0);

    const res = await request(app).get('/users');
    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);
  });
});

// ─── GET /users/:id ───

describe('GET /users/:id', () => {
  it('returns specific user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.id === USER_ID) return Promise.resolve(SAMPLE_USER);
      return Promise.resolve(null);
    });

    const res = await request(app).get(`/users/${USER_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(USER_ID);
  });

  it('returns 404 for nonexistent user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      return Promise.resolve(null);
    });

    const res = await request(app).get('/users/b0000000-0000-0000-0000-000000000099');
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /users/:id (admin update) ───

describe('PATCH /users/:id', () => {
  it('updates user profile fields', async () => {
    fns.userUpdate.mockResolvedValue({ ...SAMPLE_USER, name: 'Updated Name' });

    const res = await request(app).patch(`/users/${USER_ID}`).send({ name: 'Updated Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('rejects empty body', async () => {
    const res = await request(app).patch(`/users/${USER_ID}`).send({});
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /users/:id/role ───

describe('PATCH /users/:id/role', () => {
  it('changes user role', async () => {
    fns.roleFindUnique.mockResolvedValue({ id: TRAINER_ROLE_ID, name: 'TRAINER' });
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID, role: { name: 'ADMIN' } });
      }
      if (where.id === USER_ID) {
        return Promise.resolve({ id: USER_ID, roleId: STUDENT_ROLE_ID, role: { name: 'STUDENT' } });
      }
      return Promise.resolve(null);
    });
    fns.$transaction.mockResolvedValue([{}, {}]);

    const res = await request(app).patch(`/users/${USER_ID}/role`).send({ roleId: TRAINER_ROLE_ID });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('STUDENT');
    expect(res.body.data.message).toContain('TRAINER');
  });

  it('blocks self role change', async () => {
    fns.roleFindUnique.mockResolvedValue({ id: TRAINER_ROLE_ID, name: 'TRAINER' });
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID, role: { name: 'ADMIN' } });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).patch(`/users/${ADMIN_ID}/role`).send({ roleId: TRAINER_ROLE_ID });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('own role');
  });

  it('returns 404 for nonexistent target', async () => {
    fns.roleFindUnique.mockResolvedValue({ id: TRAINER_ROLE_ID, name: 'TRAINER' });
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) {
        return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID, role: { name: 'ADMIN' } });
      }
      return Promise.resolve(null);
    });

    const res = await request(app).patch('/users/b0000000-0000-0000-0000-000000000099/role').send({ roleId: TRAINER_ROLE_ID });
    expect(res.status).toBe(404);
  });

  it('rejects invalid role', async () => {
    const res = await request(app).patch(`/users/${USER_ID}/role`).send({ roleId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /users/:id/status ───

describe('PATCH /users/:id/status', () => {
  it('deactivates a user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.id === USER_ID) return Promise.resolve({ ...SAMPLE_USER, status: 'ACTIVE' });
      return Promise.resolve(null);
    });
    fns.$transaction.mockResolvedValue([{}, {}]);
    fns.refreshTokenUpdateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).patch(`/users/${USER_ID}/status`).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('INACTIVE');
  });

  it('activates a user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.id === USER_ID) return Promise.resolve({ ...SAMPLE_USER, status: 'INACTIVE' });
      return Promise.resolve(null);
    });
    fns.$transaction.mockResolvedValue([{}, {}]);

    const res = await request(app).patch(`/users/${USER_ID}/status`).send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('ACTIVE');
  });

  it('rejects invalid status value', async () => {
    const res = await request(app).patch(`/users/${USER_ID}/status`).send({ status: 'DELETED' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for nonexistent user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      return Promise.resolve(null);
    });

    const res = await request(app).patch('/users/b0000000-0000-0000-0000-000000000099/status').send({ status: 'ACTIVE' });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /users/:id/recover ───

describe('PATCH /users/:id/recover', () => {
  it('initiates recovery for PENDING user (activation token)', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.id === USER_ID) return Promise.resolve({ ...SAMPLE_USER, status: 'PENDING' });
      return Promise.resolve(null);
    });
    fns.activationTokenUpdateMany.mockResolvedValue({ count: 0 });
    fns.activationTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).patch(`/users/${USER_ID}/recover`);
    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain('Recovery initiated');
  });

  it('initiates recovery for ACTIVE user (reset token)', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.id === USER_ID) return Promise.resolve(SAMPLE_USER);
      return Promise.resolve(null);
    });
    fns.resetTokenUpdateMany.mockResolvedValue({ count: 0 });
    fns.resetTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).patch(`/users/${USER_ID}/recover`);
    expect(res.status).toBe(200);
  });

  it('returns 404 for nonexistent user', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      return Promise.resolve(null);
    });

    const res = await request(app).patch('/users/b0000000-0000-0000-0000-000000000099/recover');
    expect(res.status).toBe(404);
  });
});

// ─── POST /users (single create) ───

describe('POST /users', () => {
  it('creates a new user with default STUDENT role', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.email) return Promise.resolve(null);
      return Promise.resolve(null);
    });
    fns.roleFindUnique.mockResolvedValue({ id: STUDENT_ROLE_ID, name: 'STUDENT' });
    fns.userCreate.mockResolvedValue({ ...SAMPLE_USER, id: 'e0000000-0000-0000-0000-000000000005', email: 'new@test.com' });
    fns.activationTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).post('/users').send({ name: 'New User', email: 'new@test.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('new@test.com');
  });

  it('rejects duplicate email', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.email) return Promise.resolve(SAMPLE_USER);
      return Promise.resolve(null);
    });

    const res = await request(app).post('/users').send({ name: 'Dup', email: 'test@example.com' });
    expect(res.status).toBe(409);
  });

  it('validates required fields', async () => {
    const res = await request(app).post('/users').send({ name: 'No Email' });
    expect(res.status).toBe(400);
  });

  it('creates user with explicit role', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID, role: { name: 'ADMIN' } });
      if (where.email) return Promise.resolve(null);
      return Promise.resolve(null);
    });
    fns.roleFindUnique.mockResolvedValue({ id: TRAINER_ROLE_ID, name: 'TRAINER' });
    fns.userCreate.mockResolvedValue({ ...SAMPLE_USER, role: { id: TRAINER_ROLE_ID, name: 'TRAINER' } });
    fns.activationTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).post('/users').send({
      name: 'Trainer User',
      email: 'trainer@test.com',
      roleId: TRAINER_ROLE_ID,
    });
    expect(res.status).toBe(201);
  });

  it('rejects invalid roleId (non-existent)', async () => {
    const FAKE_ROLE_ID = 'e0000000-0000-0000-0000-000000000099';
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID });
      if (where.email) return Promise.resolve(null);
      return Promise.resolve(null);
    });
    fns.roleFindUnique.mockResolvedValue(null);

    const res = await request(app).post('/users').send({
      name: 'Bad Role',
      email: 'badrole@test.com',
      roleId: FAKE_ROLE_ID,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid role');
  });

  it('blocks non-admin from assigning ADMIN role', async () => {
    fns.userFindUnique.mockImplementation(({ where }: any) => {
      if (where.id === ADMIN_ID) return Promise.resolve({ id: ADMIN_ID, status: 'ACTIVE', roleId: ADMIN_ROLE_ID, role: { name: 'COORDINATOR' } });
      if (where.email) return Promise.resolve(null);
      return Promise.resolve(null);
    });
    fns.roleFindUnique.mockResolvedValue({ id: ADMIN_ROLE_ID, name: 'ADMIN' });

    const res = await request(app).post('/users').send({
      name: 'Escalation',
      email: 'escalate@test.com',
      roleId: ADMIN_ROLE_ID,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Only administrators');
  });
});

// ─── POST /admin/users/bulk-csv ───

describe('POST /admin/users/bulk-csv', () => {
  const validCsv = `name,email,department,year\nAlice,alice@test.com,CS,2\nBob,bob@test.com,ECE,3`;

  it('creates users from CSV', async () => {
    fns.roleFindUnique.mockResolvedValue({ id: STUDENT_ROLE_ID, name: 'STUDENT' });
    fns.userFindMany.mockResolvedValue([]);
    fns.userCreate
      .mockResolvedValueOnce({ id: 'f1000000-0000-0000-0000-000000000001', email: 'alice@test.com', name: 'Alice' })
      .mockResolvedValueOnce({ id: 'f2000000-0000-0000-0000-000000000002', email: 'bob@test.com', name: 'Bob' });
    fns.activationTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).post('/admin/users/bulk-csv').send({ csv: validCsv });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.rejected).toHaveLength(0);
  });

  it('rejects duplicate emails within CSV', async () => {
    const dupCsv = `name,email\nAlice,dup@test.com\nBob,dup@test.com`;
    fns.roleFindUnique.mockResolvedValue({ id: STUDENT_ROLE_ID, name: 'STUDENT' });
    fns.userFindMany.mockResolvedValue([]);
    fns.userCreate.mockResolvedValue({ id: 'f3000000-0000-0000-0000-000000000003', email: 'dup@test.com', name: 'Alice' });
    fns.activationTokenCreate.mockResolvedValue({});
    fns.auditLogCreate.mockResolvedValue({});

    const res = await request(app).post('/admin/users/bulk-csv').send({ csv: dupCsv });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.rejected).toHaveLength(1);
    expect(res.body.data.rejected[0].reason).toContain('Duplicate');
  });

  it('rejects emails already in database', async () => {
    const csv = `name,email\nExisting,existing@test.com`;
    fns.roleFindUnique.mockResolvedValue({ id: STUDENT_ROLE_ID, name: 'STUDENT' });
    fns.userFindMany.mockResolvedValue([{ email: 'existing@test.com' }]);

    const res = await request(app).post('/admin/users/bulk-csv').send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toHaveLength(0);
    expect(res.body.data.rejected).toHaveLength(1);
    expect(res.body.data.rejected[0].reason).toContain('already exists');
  });

  it('rejects missing csv field', async () => {
    const res = await request(app).post('/admin/users/bulk-csv').send({});
    expect(res.status).toBe(400);
  });

  it('rejects CSV with no data rows', async () => {
    const res = await request(app).post('/admin/users/bulk-csv').send({ csv: 'name,email' });
    expect(res.status).toBe(400);
  });
});
