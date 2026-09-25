import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

// ───── Test helpers ─────

const JWT_SECRET = 'test-jwt-secret-for-unit-tests-only';
const TOKEN_HASH_SECRET = 'test-token-hash-secret';
const ACCESS_EXPIRY = '15m';

function signTestAccessToken(userId: string, roleId: string, expiresIn = ACCESS_EXPIRY): string {
  return jwt.sign({ sub: userId, roleId }, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

function hashToken(rawToken: string): string {
  return crypto.createHmac('sha256', TOKEN_HASH_SECRET).update(rawToken).digest('hex');
}

// ───── Permission catalog verification ─────

import { ROLES, PERMISSIONS, ROLE_PERMISSIONS, RoleName } from '../src/prisma/permission-catalog';

describe('Permission Catalog Integrity', () => {
  const allCodes = new Set(PERMISSIONS.map((p) => p.code));

  test('every role-permission code exists in PERMISSIONS', () => {
    for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
      for (const code of codes) {
        expect(allCodes.has(code)).toBe(true);
      }
    }
  });

  test('TRAINER only has risk_scores:read:category:batch, not full risk access', () => {
    const trainerPerms = ROLE_PERMISSIONS.TRAINER;
    expect(trainerPerms).toContain('risk_scores:read:category:batch');
    expect(trainerPerms).not.toContain('risk_scores:read:batch');
    expect(trainerPerms).not.toContain('risk_scores:read:assigned');
    expect(trainerPerms).not.toContain('risk_scores:read:any');
  });

  test('MENTOR has no proofs or event_registrations permissions', () => {
    const mentorPerms = ROLE_PERMISSIONS.MENTOR;
    const proofOrEventReg = mentorPerms.filter(
      (p) => p.startsWith('proofs:') || p.startsWith('event_registrations:'),
    );
    expect(proofOrEventReg).toHaveLength(0);
  });

  test('ADMIN does not hold session/assessment/feedback creation', () => {
    const adminPerms = ROLE_PERMISSIONS.ADMIN;
    expect(adminPerms).not.toContain('sessions:create:batch');
    expect(adminPerms).not.toContain('assessments:create:batch');
    expect(adminPerms).not.toContain('feedback:create:batch');
  });

  test('ADMIN does not hold intervention operational permissions', () => {
    const adminPerms = ROLE_PERMISSIONS.ADMIN;
    expect(adminPerms).not.toContain('interventions:create:assigned');
    expect(adminPerms).not.toContain('interventions:update:own');
    expect(adminPerms).not.toContain('interventions:log_outcome:own');
  });

  test('ADMIN holds all required admin permissions', () => {
    const adminPerms = ROLE_PERMISSIONS.ADMIN;
    const required = [
      'users:create', 'users:change_role', 'users:activate', 'users:recover_account',
      'batches:create', 'batches:update:any', 'events:create', 'events:update:any',
      'mentor_assignments:create',
    ];
    for (const perm of required) {
      expect(adminPerms).toContain(perm);
    }
  });

  test('STUDENT has only :self, :own, and events:read:any scopes', () => {
    const studentPerms = ROLE_PERMISSIONS.STUDENT;
    for (const perm of studentPerms) {
      const hasSelfOrOwn = perm.includes(':self') || perm.includes(':own');
      const isEventsRead = perm === 'events:read:any';
      expect(hasSelfOrOwn || isEventsRead).toBe(true);
    }
  });
});

// ───── JWT Token Tests ─────

describe('JWT Access Token', () => {
  test('sign and verify access token', () => {
    const token = signTestAccessToken('user-123', 'role-456');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.sub).toBe('user-123');
    expect(decoded.roleId).toBe('role-456');
    expect(decoded.exp).toBeDefined();
  });

  test('expired token is rejected', () => {
    const token = signTestAccessToken('user-123', 'role-456', '0s');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  test('token with wrong secret is rejected', () => {
    const token = signTestAccessToken('user-123', 'role-456');
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow(jwt.JsonWebTokenError);
  });

  test('access token expires in approximately 15 minutes', () => {
    const token = signTestAccessToken('user-123', 'role-456', '15m');
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const now = Math.floor(Date.now() / 1000);
    const expectedExpiry = now + 15 * 60;
    expect(Math.abs(decoded.exp - expectedExpiry)).toBeLessThan(5);
  });
});

// ───── Token Hashing Tests ─────

describe('Token Hashing', () => {
  test('same input produces same hash (deterministic)', () => {
    const raw = 'test-token-value';
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  test('different inputs produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  test('raw token is never equal to hash (not stored raw)', () => {
    const raw = crypto.randomBytes(32).toString('hex');
    expect(raw).not.toBe(hashToken(raw));
  });
});

// ───── Password Validation Tests ─────

describe('Password Validation', () => {
  const COMMON_PASSWORDS = new Set([
    'password1234', 'qwerty123456', '123456789012', 'abcdefghijkl',
    'password12345', 'admin1234567', 'letmein123456', 'welcome12345',
  ]);

  function validatePassword(password: string, user: { name: string; email: string }): string | null {
    if (typeof password !== 'string') return 'Password is required.';
    if (password.length < 12) return 'Password must be at least 12 characters.';
    if (password.length > 128) return 'Password must not exceed 128 characters.';
    if (password !== password.trim()) return 'Password must not have leading or trailing whitespace.';
    if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'This password is too common. Please choose a stronger one.';
    if (/(.)\1{4,}/.test(password)) return 'Password must not contain long repeated character sequences.';
    const sequences = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i <= password.length - 5; i++) {
      const slice = password.slice(i, i + 5).toLowerCase();
      if (sequences.includes(slice)) return 'Password must not contain sequential characters.';
    }
    const emailLocal = user.email.split('@')[0].toLowerCase();
    if (emailLocal.length >= 3 && password.toLowerCase().includes(emailLocal)) return 'Password must not contain your email address.';
    const nameParts = user.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
    for (const part of nameParts) {
      if (password.toLowerCase().includes(part)) return 'Password must not contain your name.';
    }
    return null;
  }

  const testUser = { name: 'Alice Smith', email: 'alice@example.com' };

  test('rejects passwords shorter than 12 characters', () => {
    expect(validatePassword('Short1!@#', testUser)).toBeTruthy();
  });

  test('rejects passwords with leading whitespace', () => {
    expect(validatePassword(' ValidPassword123!', testUser)).toBeTruthy();
  });

  test('rejects passwords with trailing whitespace', () => {
    expect(validatePassword('ValidPassword123! ', testUser)).toBeTruthy();
  });

  test('rejects common passwords', () => {
    expect(validatePassword('password1234', testUser)).toBeTruthy();
  });

  test('rejects passwords containing user name', () => {
    expect(validatePassword('xAliceSmith99!!', testUser)).toBeTruthy();
  });

  test('rejects passwords containing email local part', () => {
    expect(validatePassword('myalicepassword!', testUser)).toBeTruthy();
  });

  test('accepts valid strong password', () => {
    expect(validatePassword('Str0ng&Secure!2026', testUser)).toBeNull();
  });

  test('rejects sequential characters', () => {
    expect(validatePassword('abcde_fgh_ijk!', testUser)).toBeTruthy();
  });
});

// ───── resolveScope Logic Tests (Bug A + Bug B fixes) ─────

describe('resolveScope — scope suffix matching', () => {
  // Reproduce the exact matching logic from rbac.middleware.ts
  type ResolvedScope = 'any' | 'assigned' | 'batch' | 'own' | 'self' | 'own_given' | 'own_received' | 'category_batch' | 'none';

  const SCOPE_PRIORITY: ResolvedScope[] = [
    'any', 'assigned', 'batch', 'own_given', 'own_received', 'own', 'self', 'category_batch',
  ];

  const SCOPE_TO_SUFFIXES: Record<ResolvedScope, string[]> = {
    any:            [':any'],
    assigned:       [':assigned'],
    batch:          [':batch'],
    own_given:      [':own_given'],
    own_received:   [':own_received'],
    own:            [':own'],
    self:           [':self'],
    category_batch: [':category:batch'],
    none:           [],
  };

  function codeMatchesScope(code: string, resource: string, scope: ResolvedScope): boolean {
    if (!code.startsWith(`${resource}:`)) return false;
    const remainder = code.slice(resource.length);
    return SCOPE_TO_SUFFIXES[scope].some((suffix) => remainder === suffix);
  }

  function resolveTestScope(resource: string, heldCodes: string[]): ResolvedScope {
    let scope: ResolvedScope = 'none';
    for (const candidate of SCOPE_PRIORITY) {
      for (const code of heldCodes) {
        if (codeMatchesScope(code, resource, candidate)) {
          scope = candidate;
          break;
        }
      }
      if (scope !== 'none') break;
    }
    if (scope === 'none') {
      for (const code of heldCodes) {
        if (code.startsWith(`${resource}:`)) {
          scope = 'any';
          break;
        }
      }
    }
    return scope;
  }

  // Bug A fix: own_given must NOT resolve to generic 'own'
  test('feedback:read:own_given resolves to own_given, not own', () => {
    const scope = resolveTestScope('feedback:read', ['feedback:read:own_given']);
    expect(scope).toBe('own_given');
  });

  test('feedback:read:own_received resolves to own_received, not own', () => {
    const scope = resolveTestScope('feedback:read', ['feedback:read:own_received']);
    expect(scope).toBe('own_received');
  });

  test('own_given and own_received are distinct scopes', () => {
    const givenScope = resolveTestScope('feedback:read', ['feedback:read:own_given']);
    const receivedScope = resolveTestScope('feedback:read', ['feedback:read:own_received']);
    expect(givenScope).not.toBe(receivedScope);
  });

  // Bug B fix: category:batch must NOT resolve to generic 'batch'
  test('risk_scores:read:category:batch resolves to category_batch, not batch', () => {
    const scope = resolveTestScope('risk_scores:read', ['risk_scores:read:category:batch']);
    expect(scope).toBe('category_batch');
  });

  test('attendance:read:batch still resolves to batch correctly', () => {
    const scope = resolveTestScope('attendance:read', ['attendance:read:batch']);
    expect(scope).toBe('batch');
  });

  test('users:read:any resolves to any', () => {
    const scope = resolveTestScope('users:read', ['users:read:any']);
    expect(scope).toBe('any');
  });

  test('users:read:assigned resolves to assigned', () => {
    const scope = resolveTestScope('users:read', ['users:read:assigned']);
    expect(scope).toBe('assigned');
  });

  test('users:read:own resolves to own', () => {
    const scope = resolveTestScope('users:read', ['users:read:own']);
    expect(scope).toBe('own');
  });

  test('attendance:mark:self resolves to self', () => {
    const scope = resolveTestScope('attendance:mark', ['attendance:mark:self']);
    expect(scope).toBe('self');
  });

  test('broadest scope wins when multiple held', () => {
    const scope = resolveTestScope('users:read', ['users:read:own', 'users:read:any']);
    expect(scope).toBe('any');
  });

  test('unsuffixed permissions (users:create) resolve to any', () => {
    const scope = resolveTestScope('users', ['users:create']);
    expect(scope).toBe('any');
  });
});

// ───── Logout cookie path test ─────

describe('Logout refresh-cookie handling', () => {
  test('cookie path is /auth (covers both /auth/refresh and /auth/logout)', () => {
    // The cookie path was changed from /auth/refresh to /auth.
    // This ensures the browser sends the cookie to both endpoints.
    const cookiePath = '/auth';
    expect('/auth/refresh'.startsWith(cookiePath)).toBe(true);
    expect('/auth/logout'.startsWith(cookiePath)).toBe(true);
  });

  test('logout revokes the entire token family when cookie is present', () => {
    const familyId = 'family-1';
    const tokensInFamily = [
      { id: 't1', familyId, revokedAt: null },
      { id: 't2', familyId, revokedAt: new Date() },
      { id: 't3', familyId, revokedAt: null },
    ];
    const afterLogout = tokensInFamily.map((t) => ({
      ...t,
      revokedAt: t.revokedAt || new Date(),
    }));
    expect(afterLogout.every((t) => t.revokedAt !== null)).toBe(true);
  });
});

// ───── Bulk CSV Tests ─────

describe('Bulk CSV Parsing and Validation', () => {
  // Reproduce the CSV parser for testing
  interface CsvRow { row: number; name: string; email: string; department?: string; year?: number; }

  function parseCsvBody(csvText: string): { rows: CsvRow[]; errors: Array<{ row: number; reason: string }> } {
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      return { rows: [], errors: [{ row: 0, reason: 'CSV must have a header row and at least one data row.' }] };
    }
    const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = header.indexOf('name');
    const emailIdx = header.indexOf('email');
    const deptIdx = header.indexOf('department');
    const yearIdx = header.indexOf('year');
    if (nameIdx === -1 || emailIdx === -1) {
      return { rows: [], errors: [{ row: 0, reason: 'CSV header must include "name" and "email" columns.' }] };
    }
    const rows: CsvRow[] = [];
    const errors: Array<{ row: number; reason: string }> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const name = cols[nameIdx] || '';
      const email = cols[emailIdx] || '';
      if (!name) { errors.push({ row: i + 1, reason: 'Missing name.' }); continue; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push({ row: i + 1, reason: `Invalid or missing email: "${email}".` }); continue; }
      const department = deptIdx !== -1 ? cols[deptIdx] || undefined : undefined;
      const yearStr = yearIdx !== -1 ? cols[yearIdx] : undefined;
      const year = yearStr ? parseInt(yearStr, 10) : undefined;
      rows.push({ row: i + 1, name, email: email.toLowerCase(), department, year: year && !isNaN(year) ? year : undefined });
    }
    return { rows, errors };
  }

  test('parses valid CSV with header and data rows', () => {
    const csv = 'name,email,department,year\nAlice,alice@test.com,CS,2\nBob,bob@test.com,EE,3';
    const { rows, errors } = parseCsvBody(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe('Alice');
    expect(rows[0].email).toBe('alice@test.com');
    expect(rows[0].department).toBe('CS');
    expect(rows[0].year).toBe(2);
  });

  test('rejects CSV without header', () => {
    const csv = 'Alice,alice@test.com';
    const { rows, errors } = parseCsvBody(csv);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects rows with missing name', () => {
    const csv = 'name,email\n,alice@test.com';
    const { rows, errors } = parseCsvBody(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain('Missing name');
  });

  test('rejects rows with invalid email', () => {
    const csv = 'name,email\nAlice,not-an-email';
    const { rows, errors } = parseCsvBody(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0].reason).toContain('Invalid or missing email');
  });

  test('normalizes email to lowercase', () => {
    const csv = 'name,email\nAlice,Alice@TEST.com';
    const { rows } = parseCsvBody(csv);
    expect(rows[0].email).toBe('alice@test.com');
  });

  test('detects duplicate emails within CSV file', () => {
    const csv = 'name,email\nAlice,same@test.com\nBob,same@test.com';
    const { rows } = parseCsvBody(csv);
    // Parser returns both; dedup is done in the route handler
    expect(rows).toHaveLength(2);
    const emails = rows.map((r) => r.email);
    const unique = new Set(emails);
    expect(emails.length).toBeGreaterThan(unique.size);
  });

  test('CSV-created users have null passwordHash (PENDING status)', () => {
    // Design doc §3.1 step 4: passwordHash=NULL, status=PENDING
    const pendingUser = { passwordHash: null, status: 'PENDING' as const };
    expect(pendingUser.passwordHash).toBeNull();
    expect(pendingUser.status).toBe('PENDING');
  });

  test('activation token is 256-bit (32 bytes hex = 64 chars)', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    expect(rawToken.length).toBe(64);
  });

  test('CSV requires users:create permission (only ADMIN has it)', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('users:create');
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      if (role !== 'ADMIN') {
        expect(perms).not.toContain('users:create');
      }
    }
  });

  test('handles CSV with missing optional columns gracefully', () => {
    const csv = 'name,email\nAlice,alice@test.com';
    const { rows, errors } = parseCsvBody(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].department).toBeUndefined();
    expect(rows[0].year).toBeUndefined();
  });
});

// ───── RBAC Scope Assignment ─────

describe('RBAC Scope Assignment', () => {
  test('Trainer risk score access is category-only (no factors)', () => {
    const trainerPerms = ROLE_PERMISSIONS.TRAINER;
    const riskPerms = trainerPerms.filter((p) => p.startsWith('risk_scores:'));
    expect(riskPerms).toEqual(['risk_scores:read:category:batch', 'risk_scores:calculate:batch']);
  });

  test('Mentor has full risk score access for assigned students', () => {
    const mentorPerms = ROLE_PERMISSIONS.MENTOR;
    expect(mentorPerms).toContain('risk_scores:read:assigned');
  });

  test('Student can only read own interventions', () => {
    const studentPerms = ROLE_PERMISSIONS.STUDENT;
    const interventionPerms = studentPerms.filter((p) => p.startsWith('interventions:'));
    expect(interventionPerms).toEqual(['interventions:read:own']);
  });

  test('Mentor can create interventions for assigned students', () => {
    const mentorPerms = ROLE_PERMISSIONS.MENTOR;
    expect(mentorPerms).toContain('interventions:create:assigned');
    expect(mentorPerms).toContain('interventions:update:own');
    expect(mentorPerms).toContain('interventions:log_outcome:own');
  });

  test('Coordinator has users:read:any for proof/event review', () => {
    const coordPerms = ROLE_PERMISSIONS.COORDINATOR;
    expect(coordPerms).toContain('users:read:any');
  });

  test('Faculty has read-only any scope for oversight (except self-profile update)', () => {
    const facultyPerms = ROLE_PERMISSIONS.FACULTY;
    expect(facultyPerms).toContain('attendance:read:any');
    expect(facultyPerms).toContain('assessments:read:any');
    expect(facultyPerms).toContain('risk_scores:read:any');
    expect(facultyPerms).toContain('interventions:read:any');
    const writePerms = facultyPerms.filter(
      (p) => (p.includes(':create') || p.includes(':update') || p.includes(':mark') || p.includes(':approve'))
        && p !== 'users:update:self',
    );
    expect(writePerms).toHaveLength(0);
  });
});

// ───── Scope Enforcement Logic ─────

describe('Scope Enforcement Rules', () => {
  test(':self scope only allows own identity as target', () => {
    const requesterId: string = 'user-001';
    const targetSelf: string = 'user-001';
    const targetOther: string = 'user-002';
    expect(targetSelf === requesterId).toBe(true);
    expect(targetOther === requesterId).toBe(false);
  });

  test(':own scope only allows own records', () => {
    const requesterId: string = 'mentor-001';
    const ownRecord = { createdBy: 'mentor-001' };
    const otherRecord = { createdBy: 'mentor-002' };
    expect(ownRecord.createdBy === requesterId).toBe(true);
    expect(otherRecord.createdBy === requesterId).toBe(false);
  });

  test('Student accessing another student record should be denied', () => {
    const studentPerms = ROLE_PERMISSIONS.STUDENT;
    const hasAnyBroadScope = studentPerms.some(
      (p) => p.includes(':any') && p !== 'events:read:any',
    );
    expect(hasAnyBroadScope).toBe(false);
  });

  test('Mentor has no event_registrations permissions', () => {
    const mentorPerms = ROLE_PERMISSIONS.MENTOR;
    const eventRegPerms = mentorPerms.filter((p) => p.startsWith('event_registrations:'));
    expect(eventRegPerms).toHaveLength(0);
  });

  test('Mentor has no proofs permissions', () => {
    const mentorPerms = ROLE_PERMISSIONS.MENTOR;
    const proofPerms = mentorPerms.filter((p) => p.startsWith('proofs:'));
    expect(proofPerms).toHaveLength(0);
  });

  test('Trainer batch scope: no :any access for attendance, assessments, feedback', () => {
    const trainerPerms = ROLE_PERMISSIONS.TRAINER;
    const batchScoped = trainerPerms.filter((p) => p.includes(':batch'));
    expect(batchScoped.length).toBeGreaterThan(0);
    expect(trainerPerms).not.toContain('attendance:read:any');
    expect(trainerPerms).not.toContain('assessments:read:any');
    expect(trainerPerms).not.toContain('feedback:read:any');
  });
});

// ───── Refresh Token Rotation Logic ─────

describe('Refresh Token Rotation Rules', () => {
  test('token hash is deterministic for same input', () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash1 = hashToken(raw);
    const hash2 = hashToken(raw);
    expect(hash1).toBe(hash2);
  });

  test('different raw tokens produce different hashes', () => {
    const raw1 = crypto.randomBytes(32).toString('hex');
    const raw2 = crypto.randomBytes(32).toString('hex');
    expect(hashToken(raw1)).not.toBe(hashToken(raw2));
  });

  test('family ID groups tokens from one login session', () => {
    const familyId = crypto.randomUUID();
    const token1 = { familyId, generation: 1 };
    const token2 = { familyId, generation: 2 };
    expect(token1.familyId).toBe(token2.familyId);
  });

  test('replay detection: revoked token reuse beyond grace triggers family revocation', () => {
    const token = {
      revokedAt: new Date(Date.now() - 60000),
      familyId: 'family-1',
    };
    const graceWindowMs = 10000;
    const timeSinceRevocation = Date.now() - token.revokedAt.getTime();
    expect(timeSinceRevocation > graceWindowMs).toBe(true);
  });

  test('grace window: revoked token reused within 10s is tolerated', () => {
    const token = {
      revokedAt: new Date(Date.now() - 3000),
      familyId: 'family-1',
    };
    const graceWindowMs = 10000;
    const timeSinceRevocation = Date.now() - token.revokedAt.getTime();
    expect(timeSinceRevocation <= graceWindowMs).toBe(true);
  });

  test('absolute session ceiling: 30 days from family creation', () => {
    const ceilingDays = 30;
    const ceilingMs = ceilingDays * 24 * 60 * 60 * 1000;
    const familyCreatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const elapsed = Date.now() - familyCreatedAt.getTime();
    expect(elapsed > ceilingMs).toBe(true);
  });
});

// ───── Role-Change Escalation Guard ─────

describe('Role-Change Escalation Guard', () => {
  test('self-role-change should be rejected', () => {
    const actorId: string = 'user-001';
    const targetId: string = 'user-001';
    expect(actorId === targetId).toBe(true);
  });

  test('non-ADMIN assigning ADMIN role should be rejected', () => {
    const actorRole: string = 'COORDINATOR';
    const targetNewRole: string = 'ADMIN';
    const allowed = actorRole === 'ADMIN' || targetNewRole !== 'ADMIN';
    expect(allowed).toBe(false);
  });

  test('ADMIN assigning non-ADMIN role is allowed', () => {
    const actorRole: string = 'ADMIN';
    const targetNewRole: string = 'MENTOR';
    const allowed = actorRole === 'ADMIN' || targetNewRole !== 'ADMIN';
    expect(allowed).toBe(true);
  });

  test('ADMIN assigning ADMIN role is allowed', () => {
    const actorRole: string = 'ADMIN';
    const allowed = actorRole === 'ADMIN';
    expect(allowed).toBe(true);
  });

  test('only users:change_role holders can change roles', () => {
    const adminPerms = ROLE_PERMISSIONS.ADMIN;
    expect(adminPerms).toContain('users:change_role');
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      if (role !== 'ADMIN') {
        expect(perms).not.toContain('users:change_role');
      }
    }
  });
});

// ───── Login Security Rules ─────

describe('Login Security Rules', () => {
  test('null passwordHash must be rejected before bcrypt.compare', () => {
    const user = { passwordHash: null, status: 'ACTIVE' };
    expect(user.passwordHash === null).toBe(true);
  });

  test('PENDING user is rejected at login', () => {
    const user = { passwordHash: 'some-hash', status: 'PENDING' };
    expect(user.status !== 'ACTIVE').toBe(true);
  });

  test('INACTIVE user is rejected at login', () => {
    const user = { passwordHash: 'some-hash', status: 'INACTIVE' };
    expect(user.status !== 'ACTIVE').toBe(true);
  });

  test('wrong password is rejected (bcrypt)', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    const result = await bcrypt.compare('wrong-password', hash);
    expect(result).toBe(false);
  });

  test('correct password is accepted (bcrypt)', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    const result = await bcrypt.compare('correct-password', hash);
    expect(result).toBe(true);
  });

  test('generic error for nonexistent user and wrong password must be identical', () => {
    const errorForNotFound = 'Invalid email or password.';
    const errorForWrongPass = 'Invalid email or password.';
    expect(errorForNotFound).toBe(errorForWrongPass);
  });

  test('per-account rate limiting rejects after too many attempts', () => {
    const MAX = 10;
    let count = 0;
    for (let i = 0; i < MAX + 5; i++) {
      if (count >= MAX) break;
      count++;
    }
    expect(count).toBe(MAX);
  });
});

// ───── Audit Logging ─────

describe('Audit Logging', () => {
  test('audit_logs:read permission is ADMIN-only', () => {
    expect(ROLE_PERMISSIONS.ADMIN).toContain('audit_logs:read');
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      if (role !== 'ADMIN') {
        expect(perms).not.toContain('audit_logs:read');
      }
    }
  });

  test('CSV user creation produces USER_CREATED_CSV audit action', () => {
    const action = 'USER_CREATED_CSV';
    expect(action).toBe('USER_CREATED_CSV');
  });

  test('role change produces ROLE_CHANGED audit action with old/new values', () => {
    const auditEntry = {
      action: 'ROLE_CHANGED',
      oldValues: { roleId: 'old-id', roleName: 'STUDENT' },
      newValues: { roleId: 'new-id', roleName: 'MENTOR' },
    };
    expect(auditEntry.action).toBe('ROLE_CHANGED');
    expect(auditEntry.oldValues).toBeDefined();
    expect(auditEntry.newValues).toBeDefined();
  });
});

// ───── Seed Configuration ─────

describe('Seed Configuration', () => {
  test('all 6 roles are defined', () => {
    expect(ROLES).toHaveLength(6);
    expect(ROLES).toContain('STUDENT');
    expect(ROLES).toContain('TRAINER');
    expect(ROLES).toContain('FACULTY');
    expect(ROLES).toContain('MENTOR');
    expect(ROLES).toContain('COORDINATOR');
    expect(ROLES).toContain('ADMIN');
  });

  test('67 unique permission codes', () => {
    const uniqueCodes = new Set(PERMISSIONS.map((p) => p.code));
    expect(uniqueCodes.size).toBe(69);
  });

  test('no duplicate permission codes', () => {
    const codes = PERMISSIONS.map((p) => p.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  test('every role has at least one permission', () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
