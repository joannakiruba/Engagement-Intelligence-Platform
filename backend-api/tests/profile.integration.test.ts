import jwt from 'jsonwebtoken';
import request from 'supertest';
import { ROLES, ROLE_PERMISSIONS } from '../src/prisma/permission-catalog';
import { profileUpdateSchema, SAFE_PROFILE_SELECT } from '../src/routes/users.routes';

// ─── Unit tests: exercise the ACTUAL exported profileUpdateSchema ───

describe('profileUpdateSchema — name validation', () => {
  function validate(body: unknown) {
    return profileUpdateSchema.validate(body, { allowUnknown: false, stripUnknown: false, abortEarly: false });
  }

  test('accepts valid name', () => {
    const { error, value } = validate({ name: 'Ayesha Siddiqa' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Ayesha Siddiqa');
  });

  test('trims whitespace from name', () => {
    const { error, value } = validate({ name: '  Ayesha  ' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Ayesha');
  });

  test('rejects blank/whitespace-only name', () => {
    expect(validate({ name: '' }).error).toBeDefined();
    expect(validate({ name: '   ' }).error).toBeDefined();
  });

  test('rejects name exceeding 255 characters', () => {
    expect(validate({ name: 'A'.repeat(256) }).error).toBeDefined();
  });

  test('accepts name at exactly 255 characters', () => {
    expect(validate({ name: 'A'.repeat(255) }).error).toBeUndefined();
  });

  test('rejects name with control characters', () => {
    expect(validate({ name: 'Bad\x00Name' }).error).toBeDefined();
    expect(validate({ name: 'Bad\x1fName' }).error).toBeDefined();
    expect(validate({ name: 'Bad\x7fName' }).error).toBeDefined();
  });

  test('accepts name with unicode and accents', () => {
    expect(validate({ name: 'José García' }).error).toBeUndefined();
  });
});

describe('profileUpdateSchema — phone validation', () => {
  function validate(body: unknown) {
    return profileUpdateSchema.validate(body, { allowUnknown: false, stripUnknown: false, abortEarly: false });
  }

  test('accepts valid phone with country code', () => {
    const { error, value } = validate({ phone: '+91 98765 43210' });
    expect(error).toBeUndefined();
    expect(value.phone).toBe('+91 98765 43210');
  });

  test('accepts phone with parentheses and hyphens', () => {
    expect(validate({ phone: '(555) 123-4567' }).error).toBeUndefined();
  });

  test('accepts minimal 7-digit phone', () => {
    expect(validate({ phone: '1234567' }).error).toBeUndefined();
  });

  test('accepts maximal 15-digit phone', () => {
    expect(validate({ phone: '+1 234 567 890 123 45' }).error).toBeUndefined();
  });

  test('rejects phone with fewer than 7 digits', () => {
    expect(validate({ phone: '123456' }).error).toBeDefined();
  });

  test('rejects phone with more than 15 digits', () => {
    expect(validate({ phone: '1234567890123456' }).error).toBeDefined();
  });

  test('rejects phone exceeding 30 characters', () => {
    const longPhone = '+1 (234) 567-890-123-456-789-01';
    expect(longPhone.length).toBeGreaterThan(30);
    expect(validate({ phone: longPhone }).error).toBeDefined();
  });

  test('rejects phone with letters', () => {
    expect(validate({ phone: '+1-abc-1234567' }).error).toBeDefined();
  });

  test('normalizes null to null', () => {
    const { error, value } = validate({ phone: null });
    expect(error).toBeUndefined();
    expect(value.phone).toBeNull();
  });

  test('normalizes empty string to null', () => {
    const { error, value } = validate({ phone: '' });
    expect(error).toBeUndefined();
    expect(value.phone).toBeNull();
  });

  test('normalizes whitespace-only string to null', () => {
    const { error, value } = validate({ phone: '   ' });
    expect(error).toBeUndefined();
    expect(value.phone).toBeNull();
  });

  test('rejects non-string, non-null phone', () => {
    expect(validate({ phone: 12345678 }).error).toBeDefined();
    expect(validate({ phone: true }).error).toBeDefined();
  });
});

describe('profileUpdateSchema — forbidden/unknown fields', () => {
  function validate(body: unknown) {
    return profileUpdateSchema.validate(body, { allowUnknown: false, stripUnknown: false, abortEarly: false });
  }

  test('rejects unknown field alone', () => {
    expect(validate({ email: 'hack@evil.com' }).error).toBeDefined();
    expect(validate({ roleId: 'some-id' }).error).toBeDefined();
    expect(validate({ status: 'ADMIN' }).error).toBeDefined();
    expect(validate({ passwordHash: 'x' }).error).toBeDefined();
  });

  test('rejects mixed valid + forbidden fields', () => {
    const result = validate({ name: 'Ayesha', roleId: 'some-id' });
    expect(result.error).toBeDefined();
    expect(result.error!.details.some((d: any) => d.type === 'object.unknown')).toBe(true);
  });

  test('rejects empty body', () => {
    expect(validate({}).error).toBeDefined();
  });

  test('rejects non-object body', () => {
    expect(validate(null).error).toBeDefined();
    expect(validate([]).error).toBeDefined();
    expect(validate('string').error).toBeDefined();
  });

  test('rejects id/userId in body (cross-user attack)', () => {
    expect(validate({ id: 'other-user-id', name: 'Hacker' }).error).toBeDefined();
    expect(validate({ userId: 'other-user-id', phone: '1234567' }).error).toBeDefined();
  });
});

describe('profileUpdateSchema — partial updates', () => {
  function validate(body: unknown) {
    return profileUpdateSchema.validate(body, { allowUnknown: false, stripUnknown: false, abortEarly: false });
  }

  test('accepts name-only update', () => {
    const { error, value } = validate({ name: 'New Name' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('New Name');
    expect(value.phone).toBeUndefined();
  });

  test('accepts phone-only update', () => {
    const { error, value } = validate({ phone: '+1 234 5678901' });
    expect(error).toBeUndefined();
    expect(value.phone).toBe('+1 234 5678901');
    expect(value.name).toBeUndefined();
  });

  test('accepts both name and phone', () => {
    const { error, value } = validate({ name: 'Ayesha', phone: '+91 9876543210' });
    expect(error).toBeUndefined();
    expect(value.name).toBe('Ayesha');
    expect(value.phone).toBe('+91 9876543210');
  });

  test('accepts phone=null to clear phone', () => {
    const { error, value } = validate({ phone: null });
    expect(error).toBeUndefined();
    expect(value.phone).toBeNull();
  });
});

// ─── Permission catalog: exercise the ACTUAL exported ROLE_PERMISSIONS ───

describe('Profile permission coverage — all six roles', () => {
  for (const role of ROLES) {
    test(`${role} has users:read:own`, () => {
      expect(ROLE_PERMISSIONS[role]).toContain('users:read:own');
    });

    test(`${role} has users:update:self`, () => {
      expect(ROLE_PERMISSIONS[role]).toContain('users:update:self');
    });
  }

  test('STUDENT cannot update other users', () => {
    expect(ROLE_PERMISSIONS.STUDENT).not.toContain('users:update:any');
  });
});

// ─── Inspect the ACTUAL SAFE_PROFILE_SELECT from users.routes.ts ───

describe('SAFE_PROFILE_SELECT — exported from users.routes.ts', () => {
  const topKeys = Object.keys(SAFE_PROFILE_SELECT);

  test('includes all expected display fields', () => {
    for (const field of ['id', 'name', 'email', 'phone', 'department', 'year', 'status', 'createdAt', 'updatedAt', 'role']) {
      expect(topKeys).toContain(field);
    }
  });

  test('does not include passwordHash', () => {
    expect(topKeys).not.toContain('passwordHash');
  });

  test('does not include refreshTokens', () => {
    expect(topKeys).not.toContain('refreshTokens');
  });

  test('does not include activationTokens', () => {
    expect(topKeys).not.toContain('activationTokens');
  });

  test('does not include passwordResetTokens', () => {
    expect(topKeys).not.toContain('passwordResetTokens');
  });

  test('does not include raw roleId (role is a nested select)', () => {
    expect(topKeys).not.toContain('roleId');
    expect(SAFE_PROFILE_SELECT.role).toEqual({ select: { id: true, name: true } });
  });

  test('has exactly 10 top-level keys (no accidental additions)', () => {
    expect(topKeys).toHaveLength(10);
  });
});

// ─── validateStrict middleware: exercise the ACTUAL middleware ───

describe('validateStrict middleware — imported from validate.middleware.ts', () => {
  let validateStrict: typeof import('../src/middleware/validate.middleware').validateStrict;

  beforeAll(async () => {
    const mod = await import('../src/middleware/validate.middleware');
    validateStrict = mod.validateStrict;
  });

  test('is a function that returns middleware', () => {
    const middleware = validateStrict(profileUpdateSchema);
    expect(typeof middleware).toBe('function');
    expect(middleware.length).toBe(3);
  });

  test('middleware rejects unknown fields with 400 JSON response', () => {
    const middleware = validateStrict(profileUpdateSchema);
    const req = { body: { name: 'Good', roleId: 'evil' } } as any;
    const jsonFn = jest.fn();
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn });
    const res = { status: statusFn } as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(statusFn).toHaveBeenCalledWith(400);
    expect(jsonFn).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringContaining('not allowed') }),
    );
  });

  test('middleware calls next on valid body', () => {
    const middleware = validateStrict(profileUpdateSchema);
    const req = { body: { name: '  Trimmed  ' } } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.name).toBe('Trimmed');
  });

  test('middleware normalizes phone to null on empty string', () => {
    const middleware = validateStrict(profileUpdateSchema);
    const req = { body: { phone: '' } } as any;
    const res = {} as any;
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.phone).toBeNull();
  });
});

// ─── JWT library contract (confirms the API authenticateJwt relies on) ───

describe('JWT library contract (used by authenticateJwt)', () => {
  const SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

  test('expired token throws TokenExpiredError', () => {
    const token = jwt.sign({ sub: 'u', roleId: 'r' }, SECRET, { expiresIn: '0s' } as jwt.SignOptions);
    expect(() => jwt.verify(token, SECRET)).toThrow(jwt.TokenExpiredError);
  });

  test('wrong-secret token throws JsonWebTokenError', () => {
    const token = jwt.sign({ sub: 'u', roleId: 'r' }, 'other');
    expect(() => jwt.verify(token, SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  test('valid token decodes to original payload', () => {
    const token = jwt.sign({ sub: 'u1', roleId: 'r1' }, SECRET, { expiresIn: '5m' } as jwt.SignOptions);
    const decoded = jwt.verify(token, SECRET) as any;
    expect(decoded.sub).toBe('u1');
    expect(decoded.roleId).toBe('r1');
  });
});

// ─── HTTP Integration tests (require real DB via DATABASE_URL) ───

const DB_URL = process.env.DATABASE_URL || '';
const canRunIntegration = DB_URL.length > 0
  && !DB_URL.includes('test_skip')
  && !DB_URL.includes('placeholder')
  && !DB_URL.includes('skip');

const describeIntegration = canRunIntegration ? describe : describe.skip;

describeIntegration('HTTP integration — profile endpoints', () => {
  let app: any;
  let prismaClient: any;

  const TEST_USERS = [
    { email: 'admin@hope.dev', role: 'ADMIN' },
    { email: 'coordinator@hope.dev', role: 'COORDINATOR' },
    { email: 'mentor@hope.dev', role: 'MENTOR' },
    { email: 'faculty@hope.dev', role: 'FACULTY' },
    { email: 'trainer@hope.dev', role: 'TRAINER' },
    { email: 'student@hope.dev', role: 'STUDENT' },
  ];

  function signToken(userId: string, roleId: string, expiresIn = '5m'): string {
    return jwt.sign({ sub: userId, roleId }, process.env.JWT_SECRET!, {
      expiresIn,
    } as jwt.SignOptions);
  }

  async function getUserWithRole(email: string) {
    return prismaClient.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  beforeAll(async () => {
    const server = await import('../src/server');
    app = server.default;
    const prismaModule = await import('../src/lib/prisma');
    prismaClient = prismaModule.default;
  });

  afterAll(async () => {
    if (prismaClient) await prismaClient.$disconnect();
  });

  // ─── GET /users/me: all six roles ───

  describe('GET /users/me — all six roles', () => {
    for (const { email, role } of TEST_USERS) {
      test(`${role} can read own profile`, async () => {
        const user = await getUserWithRole(email);
        const token = signToken(user.id, user.roleId);

        const res = await request(app)
          .get('/users/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(user.id);
        expect(res.body.data.email).toBe(email);
        expect(res.body.data.role.name).toBe(role);
        expect(res.headers['cache-control']).toBe('no-store');
      });
    }
  });

  // ─── Safe response fields ───

  describe('GET /users/me — safe response fields', () => {
    test('response contains all expected safe fields and no sensitive fields', async () => {
      const user = await getUserWithRole('student@hope.dev');
      const token = signToken(user.id, user.roleId);

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const data = res.body.data;

      // Expected fields present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('name');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('phone');
      expect(data).toHaveProperty('department');
      expect(data).toHaveProperty('year');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');
      expect(data).toHaveProperty('role');
      expect(data.role).toHaveProperty('id');
      expect(data.role).toHaveProperty('name');

      // Sensitive fields absent
      expect(data).not.toHaveProperty('passwordHash');
      expect(data).not.toHaveProperty('refreshTokens');
      expect(data).not.toHaveProperty('activationTokens');
      expect(data).not.toHaveProperty('passwordResetTokens');
      expect(data).not.toHaveProperty('roleId');
    });
  });

  // ─── PATCH /users/me: all six roles ───

  describe('PATCH /users/me — all six roles', () => {
    for (const { email, role } of TEST_USERS) {
      test(`${role} can update own name`, async () => {
        const user = await getUserWithRole(email);
        const token = signToken(user.id, user.roleId);
        const newName = `${role} Updated ${Date.now()}`;

        const res = await request(app)
          .patch('/users/me')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: newName });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe(newName);
        expect(res.body.data.id).toBe(user.id);
        expect(res.headers['cache-control']).toBe('no-store');
      });
    }
  });

  // ─── Phone removal ───

  describe('PATCH /users/me — phone removal', () => {
    test('setting phone to null clears it', async () => {
      const user = await getUserWithRole('student@hope.dev');
      const token = signToken(user.id, user.roleId);

      // First set a phone
      await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+91 1234567890' });

      // Verify it was set
      let res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.data.phone).toBe('+91 1234567890');

      // Clear it
      res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: null });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBeNull();

      // Verify persistence
      res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.data.phone).toBeNull();
    });

    test('setting phone to empty string clears it', async () => {
      const user = await getUserWithRole('trainer@hope.dev');
      const token = signToken(user.id, user.roleId);

      await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+1 5551234567' });

      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '' });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBeNull();
    });
  });

  // ─── Missing/expired authentication ───

  describe('Authentication errors', () => {
    test('GET /users/me without token returns 401', async () => {
      const res = await request(app).get('/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /users/me with invalid token returns 401', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /users/me with expired token returns 401', async () => {
      const user = await getUserWithRole('student@hope.dev');
      const token = signToken(user.id, user.roleId, '0s');

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('PATCH /users/me without token returns 401', async () => {
      const res = await request(app)
        .patch('/users/me')
        .send({ name: 'Hacker' });
      expect(res.status).toBe(401);
    });

    test('PATCH /users/me with expired token returns 401', async () => {
      const user = await getUserWithRole('student@hope.dev');
      const token = signToken(user.id, user.roleId, '0s');

      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacker' });
      expect(res.status).toBe(401);
    });
  });

  // ─── Inactive account ───

  describe('Inactive account guard', () => {
    let originalStatus: string;
    let user: any;

    beforeAll(async () => {
      user = await getUserWithRole('student@hope.dev');
      originalStatus = user.status;
    });

    afterAll(async () => {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { status: originalStatus },
      });
    });

    test('INACTIVE user with valid JWT is rejected on GET', async () => {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      });

      const token = signToken(user.id, user.roleId);

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not active/i);
    });

    test('INACTIVE user with valid JWT is rejected on PATCH', async () => {
      const token = signToken(user.id, user.roleId);

      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Should Fail' });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not active/i);
    });

    test('PENDING user with valid JWT is rejected', async () => {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { status: 'PENDING' },
      });

      const token = signToken(user.id, user.roleId);

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not active/i);
    });
  });

  // ─── Stale JWT role ───

  describe('Stale JWT roleId', () => {
    test('requireActiveUser overwrites stale roleId from JWT', async () => {
      const user = await getUserWithRole('student@hope.dev');
      // Make sure user is ACTIVE
      await prismaClient.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });

      // Sign a token with a fake roleId that doesn't exist in the DB
      const fakeRoleId = '00000000-0000-0000-0000-000000000000';
      const token = signToken(user.id, fakeRoleId);

      // The requireActiveUser middleware should overwrite the JWT roleId
      // with the actual DB roleId, so permission check should pass
      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.role.name).toBe('STUDENT');
    });
  });

  // ─── Cross-user isolation ───

  describe('Cross-user isolation', () => {
    test('JWT subject determines the profile, not any body field', async () => {
      const student = await getUserWithRole('student@hope.dev');
      const admin = await getUserWithRole('admin@hope.dev');
      const studentToken = signToken(student.id, student.roleId);

      // Attempt to sneak the admin's ID into the body
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Cross-user test', id: admin.id });

      // Should be rejected because 'id' is an unknown field
      expect(res.status).toBe(400);
    });

    test('student GET /users/me returns only their own data', async () => {
      const student = await getUserWithRole('student@hope.dev');
      const admin = await getUserWithRole('admin@hope.dev');
      const studentToken = signToken(student.id, student.roleId);

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(student.id);
      expect(res.body.data.id).not.toBe(admin.id);
    });

    test('PATCH with valid name updates only the JWT owner', async () => {
      const student = await getUserWithRole('student@hope.dev');
      const admin = await getUserWithRole('admin@hope.dev');
      const studentToken = signToken(student.id, student.roleId);

      const uniqueName = `Student Isolation ${Date.now()}`;
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: uniqueName });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe(uniqueName);

      // Verify admin's name is unchanged
      const adminAfter = await prismaClient.user.findUnique({ where: { id: admin.id } });
      expect(adminAfter.name).not.toBe(uniqueName);
    });
  });

  // ─── Forbidden and mixed-field payloads ───

  describe('Forbidden field rejection via HTTP', () => {
    let token: string;

    beforeAll(async () => {
      const user = await getUserWithRole('student@hope.dev');
      // Ensure ACTIVE
      await prismaClient.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' },
      });
      token = signToken(user.id, user.roleId);
    });

    test('rejects email field', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'hack@evil.com' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('rejects roleId field', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(400);
    });

    test('rejects status field', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ADMIN' });
      expect(res.status).toBe(400);
    });

    test('rejects passwordHash field', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ passwordHash: 'hacked' });
      expect(res.status).toBe(400);
    });

    test('rejects mixed valid + forbidden fields', async () => {
      const nameBefore = (await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)).body.data.name;

      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Should Not Persist', roleId: 'evil-role' });

      expect(res.status).toBe(400);

      // Verify name was NOT changed
      const after = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);
      expect(after.body.data.name).toBe(nameBefore);
    });

    test('rejects empty body', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Audit log verification ───

  describe('Audit log', () => {
    test('PATCH /users/me creates a PROFILE_UPDATED audit record', async () => {
      const user = await getUserWithRole('admin@hope.dev');
      const token = signToken(user.id, user.roleId);

      const uniqueName = `Audit Test ${Date.now()}`;

      await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: uniqueName });

      const auditRecord = await prismaClient.auditLog.findFirst({
        where: {
          userId: user.id,
          entityType: 'User',
          entityId: user.id,
          action: 'PROFILE_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditRecord).not.toBeNull();
      expect(auditRecord.newValues).toEqual(expect.objectContaining({ name: uniqueName }));
      expect(auditRecord.oldValues).toHaveProperty('name');
      // Audit should never contain sensitive fields
      expect(auditRecord.newValues).not.toHaveProperty('passwordHash');
      expect(auditRecord.oldValues).not.toHaveProperty('passwordHash');
    });

    test('audit old/new values capture phone removal', async () => {
      const user = await getUserWithRole('mentor@hope.dev');
      const token = signToken(user.id, user.roleId);

      // Set a phone first
      await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '+1 9876543210' });

      // Clear phone
      await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: null });

      const auditRecord = await prismaClient.auditLog.findFirst({
        where: {
          userId: user.id,
          action: 'PROFILE_UPDATED',
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditRecord).not.toBeNull();
      expect(auditRecord.newValues).toEqual(expect.objectContaining({ phone: null }));
      expect(auditRecord.oldValues).toHaveProperty('phone', '+1 9876543210');
    });
  });

  // ─── Transaction atomicity ───

  describe('Transaction atomicity', () => {
    test('user update and audit log are created together', async () => {
      const user = await getUserWithRole('faculty@hope.dev');
      const token = signToken(user.id, user.roleId);

      const countBefore = await prismaClient.auditLog.count({
        where: { userId: user.id, action: 'PROFILE_UPDATED' },
      });

      const uniqueName = `Faculty TX ${Date.now()}`;
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: uniqueName });

      expect(res.status).toBe(200);

      const countAfter = await prismaClient.auditLog.count({
        where: { userId: user.id, action: 'PROFILE_UPDATED' },
      });

      expect(countAfter).toBe(countBefore + 1);

      const dbUser = await prismaClient.user.findUnique({ where: { id: user.id } });
      expect(dbUser.name).toBe(uniqueName);
    });
  });

  // ─── Token for deleted/non-existent user ───

  describe('Non-existent user', () => {
    test('JWT for non-existent user returns 401', async () => {
      const token = signToken('00000000-0000-0000-0000-000000000000', 'fake-role-id');

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // ─── Restore test data ───

  afterAll(async () => {
    // Restore test users' names to originals
    const originals = [
      { email: 'admin@hope.dev', name: 'Admin User' },
      { email: 'coordinator@hope.dev', name: 'Coordinator User' },
      { email: 'mentor@hope.dev', name: 'Mentor User' },
      { email: 'faculty@hope.dev', name: 'Faculty User' },
      { email: 'trainer@hope.dev', name: 'Trainer User' },
      { email: 'student@hope.dev', name: 'Student User' },
    ];

    for (const { email, name } of originals) {
      await prismaClient.user.update({
        where: { email },
        data: { name, status: 'ACTIVE', phone: null },
      }).catch(() => {});
    }
  });
});
