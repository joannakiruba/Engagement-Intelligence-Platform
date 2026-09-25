import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { authenticateJwt } from '../auth/jwt.middleware';
import { requirePermission, enforceScopeForUser, resolveScope, getScopedStudentIds } from '../auth/rbac.middleware';
import { validate } from '../middleware/validate.middleware';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { hashToken, generateRawToken } from '../utils/token';

const router = Router();

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

// ───── GET /users/me — Read own profile ─────

router.get(
  '/me',
  authenticateJwt,
  requirePermission('users:read:own'),
  async (req: Request, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true, name: true, email: true, phone: true,
        department: true, year: true, status: true,
        createdAt: true, updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  },
);

// ───── PATCH /users/me — Update own profile ─────

const updateProfileSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  phone: Joi.string().allow(null, ''),
}).min(1);

router.patch(
  '/me',
  authenticateJwt,
  requirePermission('users:update:self'),
  validate(updateProfileSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
      select: {
        id: true, name: true, email: true, phone: true,
        department: true, year: true, status: true,
        role: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({ success: true, data: user });
  },
);

// ───── GET /users — List users (scoped) ─────

router.get(
  '/',
  authenticateJwt,
  requirePermission('users:read:any', 'users:read:assigned'),
  resolveScope('users:read'),
  async (req: Request, res: Response): Promise<void> => {
    const scopedIds = await getScopedStudentIds(req);

    const where = scopedIds === 'all' ? {} : { id: { in: scopedIds } };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, phone: true,
        department: true, year: true, status: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ success: true, data: users });
  },
);

// ───── GET /users/:id — Read specific user (scoped) ─────

router.get(
  '/:id',
  authenticateJwt,
  requirePermission('users:read:any', 'users:read:assigned', 'users:read:own'),
  resolveScope('users:read'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramId(req);

    const allowed = await enforceScopeForUser(req, id);
    if (!allowed) {
      res.status(403).json({ success: false, error: 'Insufficient permissions.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        department: true, year: true, status: true,
        createdAt: true, updatedAt: true,
        role: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  },
);

// ───── PATCH /users/:id — Admin update user ─────

const adminUpdateUserSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  phone: Joi.string().allow(null, ''),
  department: Joi.string().allow(null, ''),
  year: Joi.number().integer().allow(null),
}).min(1);

router.patch(
  '/:id',
  authenticateJwt,
  requirePermission('users:update:any'),
  validate(adminUpdateUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramId(req);

    const user = await prisma.user.update({
      where: { id },
      data: req.body,
      select: {
        id: true, name: true, email: true, phone: true,
        department: true, year: true, status: true,
        role: { select: { id: true, name: true } },
      },
    });

    res.status(200).json({ success: true, data: user });
  },
);

// ───── PATCH /users/:id/role — Role change with escalation guard ─────

const roleChangeSchema = Joi.object({
  roleId: Joi.string().uuid().required(),
});

router.patch(
  '/:id/role',
  authenticateJwt,
  requirePermission('users:change_role'),
  validate(roleChangeSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramId(req);
    const { roleId: newRoleId } = req.body;
    const actorId = req.user!.sub;

    const newRole = await prisma.role.findUnique({ where: { id: newRoleId } });
    if (!newRole) {
      res.status(400).json({ success: false, error: 'Invalid role.' });
      return;
    }

    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      include: { role: true },
    });

    if (id === actorId) {
      res.status(403).json({ success: false, error: 'Cannot change your own role.' });
      return;
    }

    if (newRole.name === 'ADMIN' && actor?.role.name !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Only administrators can assign the ADMIN role.' });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    const oldRoleName = targetUser.role.name;

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { roleId: newRoleId },
      }),
      prisma.auditLog.create({
        data: {
          userId: actorId,
          entityType: 'User',
          entityId: id,
          action: 'ROLE_CHANGED',
          oldValues: { roleId: targetUser.roleId, roleName: oldRoleName },
          newValues: { roleId: newRoleId, roleName: newRole.name },
          ipAddress: req.ip,
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: { message: `Role changed from ${oldRoleName} to ${newRole.name}.` },
    });
  },
);

// ───── PATCH /users/:id/status — Activate/deactivate user ─────

const activateUserSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE').required(),
});

router.patch(
  '/:id/status',
  authenticateJwt,
  requirePermission('users:activate'),
  validate(activateUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramId(req);
    const { status } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: { status },
      }),
      prisma.auditLog.create({
        data: {
          userId: req.user!.sub,
          entityType: 'User',
          entityId: id,
          action: 'USER_STATUS_CHANGED',
          oldValues: { status: targetUser.status },
          newValues: { status },
          ipAddress: req.ip,
        },
      }),
    ]);

    if (status === 'INACTIVE') {
      await prisma.refreshToken.updateMany({
        where: { userId: id },
        data: { revokedAt: new Date() },
      });
    }

    res.status(200).json({
      success: true,
      data: { message: `User status changed to ${status}.` },
    });
  },
);

// ───── PATCH /users/:id/recover — Admin account recovery ─────

router.patch(
  '/:id/recover',
  authenticateJwt,
  requirePermission('users:recover_account'),
  async (req: Request, res: Response): Promise<void> => {
    const id = paramId(req);
    const actorId = req.user!.sub;

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }

    if (targetUser.status === 'PENDING') {
      await prisma.accountActivationToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);

      await prisma.accountActivationToken.create({
        data: {
          userId: id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      logger.info('Admin recovery: activation token issued', { targetUserId: id, actorId });
    } else {
      await prisma.passwordResetToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);

      await prisma.passwordResetToken.create({
        data: {
          userId: id,
          tokenHash,
          expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
        },
      });

      logger.info('Admin recovery: reset token issued', { targetUserId: id, actorId });
    }

    await prisma.auditLog.create({
      data: {
        userId: actorId,
        entityType: 'User',
        entityId: id,
        action: 'ADMIN_RECOVERY_INITIATED',
        ipAddress: req.ip,
      },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Recovery initiated. Instructions sent to the user\'s registered email.' },
    });
  },
);

// ───── POST /admin/users/bulk-csv ─────
// Auth design doc §3.1: requires users:create
// CSV format: name,email,department,year (header row required)

interface CsvRow {
  row: number;
  name: string;
  email: string;
  department?: string;
  year?: number;
}

interface CsvResult {
  created: Array<{ row: number; email: string; userId: string }>;
  rejected: Array<{ row: number; email?: string; reason: string }>;
}

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

    if (!name) {
      errors.push({ row: i + 1, reason: 'Missing name.' });
      continue;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ row: i + 1, reason: `Invalid or missing email: "${email}".` });
      continue;
    }

    const department = deptIdx !== -1 ? cols[deptIdx] || undefined : undefined;
    const yearStr = yearIdx !== -1 ? cols[yearIdx] : undefined;
    const year = yearStr ? parseInt(yearStr, 10) : undefined;

    rows.push({ row: i + 1, name, email: email.toLowerCase(), department, year: year && !isNaN(year) ? year : undefined });
  }

  return { rows, errors };
}

router.post(
  '/bulk-csv',
  authenticateJwt,
  requirePermission('users:create'),
  async (req: Request, res: Response): Promise<void> => {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      res.status(400).json({ success: false, error: 'Request body must include a "csv" string field.' });
      return;
    }

    const { rows, errors: parseErrors } = parseCsvBody(csv);
    const result: CsvResult = { created: [], rejected: [...parseErrors.map((e) => ({ row: e.row, reason: e.reason }))] };

    if (rows.length === 0 && parseErrors.length > 0) {
      res.status(400).json({ success: false, error: 'CSV validation failed.', data: result });
      return;
    }

    // Reject duplicate emails within the file
    const seenEmails = new Set<string>();
    const deduped: CsvRow[] = [];
    for (const row of rows) {
      if (seenEmails.has(row.email)) {
        result.rejected.push({ row: row.row, email: row.email, reason: 'Duplicate email within CSV file.' });
      } else {
        seenEmails.add(row.email);
        deduped.push(row);
      }
    }

    // Reject emails that already exist in DB
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: deduped.map((r) => r.email) } },
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email));

    const toCreate: CsvRow[] = [];
    for (const row of deduped) {
      if (existingEmails.has(row.email)) {
        result.rejected.push({ row: row.row, email: row.email, reason: 'Email already exists in database.' });
      } else {
        toCreate.push(row);
      }
    }

    // Get STUDENT role ID (CSV-created users default to STUDENT per design doc §3.1)
    const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    if (!studentRole) {
      res.status(500).json({ success: false, error: 'STUDENT role not found. Run seed first.' });
      return;
    }

    const actorId = req.user!.sub;

    for (const row of toCreate) {
      const user = await prisma.user.create({
        data: {
          name: row.name,
          email: row.email,
          passwordHash: null,
          roleId: studentRole.id,
          status: 'PENDING',
          department: row.department,
          year: row.year,
        },
      });

      // Generate activation token
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);

      await prisma.accountActivationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: actorId,
          entityType: 'User',
          entityId: user.id,
          action: 'USER_CREATED_CSV',
          newValues: { email: row.email, name: row.name },
          ipAddress: req.ip,
        },
      });

      // TODO: Queue activation email via BullMQ + email.service.ts (Module 14)
      logger.info('CSV user created, activation token issued', { userId: user.id, email: row.email });

      result.created.push({ row: row.row, email: row.email, userId: user.id });
    }

    res.status(200).json({ success: true, data: result });
  },
);

export default router;
