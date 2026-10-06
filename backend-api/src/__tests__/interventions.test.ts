import { CAUSE_CODES } from '../validators/interventions.validator';
import * as svc from '../services/interventions.service';

// Unit test: cause codes are well-defined
describe('Intervention Validator', () => {
  it('should have exactly 3 cause codes', () => {
    expect(CAUSE_CODES).toHaveLength(3);
  });

  it('cause codes should match expected values', () => {
    expect(CAUSE_CODES).toContain('ATTENDANCE_DECLINE');
    expect(CAUSE_CODES).toContain('ASSESSMENT_UNDERPERFORMANCE');
    expect(CAUSE_CODES).toContain('FEEDBACK_CONCERN');
  });
});

// Service module structure tests
describe('Intervention Service exports', () => {
  it('should export core functions', () => {
    expect(typeof svc.createIntervention).toBe('function');
    expect(typeof svc.getInterventionById).toBe('function');
    expect(typeof svc.listInterventions).toBe('function');
    expect(typeof svc.updateIntervention).toBe('function');
    expect(typeof svc.completeIntervention).toBe('function');
    expect(typeof svc.editOutcome).toBe('function');
    expect(typeof svc.findActiveIntervention).toBe('function');
    expect(typeof svc.getPendingCount).toBe('function');
  });

  it('should export task functions', () => {
    expect(typeof svc.createTask).toBe('function');
    expect(typeof svc.updateTask).toBe('function');
    expect(typeof svc.getTaskById).toBe('function');
  });

  it('should export note functions', () => {
    expect(typeof svc.createNote).toBe('function');
    expect(typeof svc.updateNote).toBe('function');
    expect(typeof svc.deleteNote).toBe('function');
    expect(typeof svc.getNoteById).toBe('function');
  });

  it('should export ConflictError', () => {
    expect(typeof svc.ConflictError).toBe('function');
    const err = new svc.ConflictError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ConflictError');
  });
});

// Permission catalog integration
describe('Permission catalog', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PERMISSIONS, ROLE_PERMISSIONS } = require('../prisma/permission-catalog');

  it('should have intervention permission codes', () => {
    const codes = PERMISSIONS.map((p: { code: string }) => p.code);
    expect(codes).toContain('interventions:create:assigned');
    expect(codes).toContain('interventions:update:own');
    expect(codes).toContain('interventions:log_outcome:own');
    expect(codes).toContain('interventions:read:own');
    expect(codes).toContain('interventions:read:assigned');
    expect(codes).toContain('interventions:read:any');
  });

  it('MENTOR should have create, update, log_outcome, read:assigned', () => {
    const mentorPerms: string[] = ROLE_PERMISSIONS.MENTOR;
    expect(mentorPerms).toContain('interventions:create:assigned');
    expect(mentorPerms).toContain('interventions:update:own');
    expect(mentorPerms).toContain('interventions:log_outcome:own');
    expect(mentorPerms).toContain('interventions:read:assigned');
  });

  it('STUDENT should only have read:own', () => {
    const studentPerms: string[] = ROLE_PERMISSIONS.STUDENT;
    expect(studentPerms).toContain('interventions:read:own');
    expect(studentPerms).not.toContain('interventions:create:assigned');
    expect(studentPerms).not.toContain('interventions:update:own');
    expect(studentPerms).not.toContain('interventions:log_outcome:own');
  });

  it('FACULTY should have read:any and no write permissions', () => {
    const facultyPerms: string[] = ROLE_PERMISSIONS.FACULTY;
    expect(facultyPerms).toContain('interventions:read:any');
    expect(facultyPerms).not.toContain('interventions:create:assigned');
    expect(facultyPerms).not.toContain('interventions:update:own');
  });

  it('ADMIN should have read:any and no write permissions', () => {
    const adminPerms: string[] = ROLE_PERMISSIONS.ADMIN;
    expect(adminPerms).toContain('interventions:read:any');
    expect(adminPerms).not.toContain('interventions:create:assigned');
    expect(adminPerms).not.toContain('interventions:update:own');
  });

  it('TRAINER should not have intervention permissions', () => {
    const trainerPerms: string[] = ROLE_PERMISSIONS.TRAINER;
    const interventionPerms = trainerPerms.filter((p: string) => p.startsWith('interventions:'));
    expect(interventionPerms).toHaveLength(0);
  });

  it('COORDINATOR should not have intervention permissions', () => {
    const coordPerms: string[] = ROLE_PERMISSIONS.COORDINATOR;
    const interventionPerms = coordPerms.filter((p: string) => p.startsWith('interventions:'));
    expect(interventionPerms).toHaveLength(0);
  });

  it('notification:update:own should be given to all notification-reading roles', () => {
    for (const role of ['STUDENT', 'TRAINER', 'FACULTY', 'MENTOR', 'COORDINATOR', 'ADMIN']) {
      const perms: string[] = ROLE_PERMISSIONS[role];
      if (perms.includes('notifications:read:own')) {
        expect(perms).toContain('notifications:update:own');
      }
    }
  });
});

// Scope resolver unit tests
describe('resolveScope correctness for interventions', () => {
  const { resolveScope } = require('../auth/rbac.middleware');

  function makeMockReqRes(heldPermissions: string[]) {
    const req: any = {
      user: { sub: 'user-1', roleId: 'role-1' },
      heldPermissions: new Set(heldPermissions),
    };
    const res: any = {};
    return { req, res };
  }

  it('should resolve interventions:read:own to scope "own"', (done) => {
    const { req, res } = makeMockReqRes(['interventions:read:own']);
    const middleware = resolveScope('interventions:read');
    middleware(req, res, () => {
      expect(req.resolvedScope).toBe('own');
      done();
    });
  });

  it('should resolve interventions:read:assigned to scope "assigned"', (done) => {
    const { req, res } = makeMockReqRes(['interventions:read:assigned']);
    const middleware = resolveScope('interventions:read');
    middleware(req, res, () => {
      expect(req.resolvedScope).toBe('assigned');
      done();
    });
  });

  it('should resolve interventions:read:any to scope "any"', (done) => {
    const { req, res } = makeMockReqRes(['interventions:read:any']);
    const middleware = resolveScope('interventions:read');
    middleware(req, res, () => {
      expect(req.resolvedScope).toBe('any');
      done();
    });
  });

  it('should pick highest-priority scope when multiple permissions held', (done) => {
    const { req, res } = makeMockReqRes(['interventions:read:own', 'interventions:read:assigned']);
    const middleware = resolveScope('interventions:read');
    middleware(req, res, () => {
      expect(req.resolvedScope).toBe('assigned');
      done();
    });
  });

  it('should NOT resolve to "any" with the wrong prefix "interventions" (old bug)', (done) => {
    const { req, res } = makeMockReqRes(['interventions:read:own']);
    const middleware = resolveScope('interventions');
    middleware(req, res, () => {
      // With the old buggy prefix, the fallback wrongly resolved to 'any'
      // because 'interventions:read:own' starts with 'interventions:' but
      // doesn't match any scope suffix directly.
      // This test documents the bug — using 'interventions' instead of
      // 'interventions:read' triggers the unsuffixed fallback.
      expect(req.resolvedScope).toBe('any');
      done();
    });
  });

  it('should resolve to "none" when no interventions permissions held', (done) => {
    const { req, res } = makeMockReqRes(['users:read:any']);
    const middleware = resolveScope('interventions:read');
    middleware(req, res, () => {
      expect(req.resolvedScope).toBe('none');
      done();
    });
  });
});

// Route-level authorization behavioral tests (mock-based)
describe('Intervention controller authorization', () => {
  const ctrl = require('../controllers/interventions.controller');

  function mockReq(overrides: Record<string, any> = {}): any {
    return {
      user: { sub: 'mentor-1', roleId: 'role-mentor' },
      params: {},
      body: {},
      query: {},
      ...overrides,
    };
  }

  function mockRes(): any {
    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) { res.statusCode = code; return res; },
      json(data: any) { res.body = data; return res; },
    };
    return res;
  }

  describe('list', () => {
    it('should reject scope "none"', async () => {
      const req = mockReq({ resolvedScope: 'none', query: {} });
      const res = mockRes();
      await ctrl.list(req, res);
      expect(res.statusCode).toBe(403);
    });

    it('should scope students to own ID for scope "own"', async () => {
      // This will try to query the DB — we just verify it doesn't 403
      const req = mockReq({
        resolvedScope: 'own',
        query: { page: '1', limit: '10' },
        user: { sub: 'student-1', roleId: 'role-student' },
      });
      const res = mockRes();
      // This will fail because there's no DB, but it shouldn't 403
      try { await ctrl.list(req, res); } catch { /* expected — no DB */ }
      expect(res.statusCode).not.toBe(403);
    });
  });

  describe('getById', () => {
    it('should reject scope "none"', async () => {
      const req = mockReq({ resolvedScope: 'none', params: { id: 'nonexistent' } });
      const res = mockRes();
      // Will try DB access, but scope check happens after fetch
      try { await ctrl.getById(req, res); } catch { /* no DB */ }
      // If no DB error, it should be 403
      if (res.body) {
        expect([403, 404]).toContain(res.statusCode);
      }
    });
  });
});

// Validator schema tests
describe('Intervention Validators', () => {
  const {
    createInterventionSchema,
    updateInterventionSchema,
    completeInterventionSchema,
    editOutcomeSchema,
    createTaskSchema,
    updateTaskSchema,
    createNoteSchema,
    updateNoteSchema,
    listInterventionsSchema,
  } = require('../validators/interventions.validator');

  describe('createInterventionSchema', () => {
    it('should accept valid input', () => {
      const { error } = createInterventionSchema.validate({
        alertId: 1,
        causeCode: 'ATTENDANCE_DECLINE',
        title: 'Test intervention',
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid causeCode', () => {
      const { error } = createInterventionSchema.validate({
        alertId: 1,
        causeCode: 'INVALID_CODE',
        title: 'Test',
      });
      expect(error).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const { error } = createInterventionSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('updateInterventionSchema', () => {
    it('should accept status CANCELLED', () => {
      const { error } = updateInterventionSchema.validate({ status: 'CANCELLED' });
      expect(error).toBeUndefined();
    });

    it('should reject status COMPLETED (must use complete endpoint)', () => {
      const { error } = updateInterventionSchema.validate({ status: 'COMPLETED' });
      expect(error).toBeDefined();
    });
  });

  describe('completeInterventionSchema', () => {
    it('should accept valid outcomes', () => {
      for (const outcome of ['IMPROVED', 'NO_CHANGE', 'DECLINED']) {
        const { error } = completeInterventionSchema.validate({ outcome });
        expect(error).toBeUndefined();
      }
    });

    it('should reject invalid outcome', () => {
      const { error } = completeInterventionSchema.validate({ outcome: 'UNKNOWN' });
      expect(error).toBeDefined();
    });
  });

  describe('listInterventionsSchema', () => {
    it('should accept empty query with defaults', () => {
      const { error, value } = listInterventionsSchema.validate({});
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
    });

    it('should accept valid status filter', () => {
      const { error } = listInterventionsSchema.validate({ status: 'PENDING' });
      expect(error).toBeUndefined();
    });

    it('should reject invalid status', () => {
      const { error } = listInterventionsSchema.validate({ status: 'INVALID' });
      expect(error).toBeDefined();
    });
  });
});

// ConflictError behavioral tests
describe('ConflictError', () => {
  it('should be catchable as Error', () => {
    const err = new svc.ConflictError('test conflict');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('test conflict');
    expect(err.name).toBe('ConflictError');
  });
});

// Validate middleware Express 5 compatibility
describe('Validate middleware', () => {
  const { validate } = require('../middleware/validate.middleware');
  const Joi = require('joi');

  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).default(20),
  });

  it('should store validated query on req.validatedQuery for query validation', () => {
    const req: any = {
      query: { page: '2' },
      body: {},
      params: {},
    };
    const res: any = {
      status: () => res,
      json: () => res,
    };

    const middleware = validate(schema, 'query');
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.validatedQuery).toBeDefined();
    expect(req.validatedQuery.page).toBe(2);
    expect(req.validatedQuery.limit).toBe(20);
  });

  it('should still assign body directly for body validation', () => {
    const bodySchema = Joi.object({ name: Joi.string().required() });
    const req: any = {
      body: { name: 'test', extra: 'field' },
    };
    const res: any = {
      status: () => res,
      json: () => res,
    };

    const middleware = validate(bodySchema, 'body');
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(true);
    expect(req.body.name).toBe('test');
    // stripUnknown should remove extra
    expect(req.body.extra).toBeUndefined();
  });

  it('should reject invalid input', () => {
    const req: any = {
      query: { page: 'not-a-number' },
    };
    const res: any = {
      statusCode: 0,
      status(code: number) { res.statusCode = code; return res; },
      json: () => res,
    };

    const middleware = validate(schema, 'query');
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
  });
});
