import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config';
import { signAccessToken } from './jwt.middleware';
import { logger } from '../utils/logger';
import prisma from '../lib/prisma';
import { hashToken, generateRawToken } from '../utils/token';
import { queueActivationEmail, queuePasswordResetEmail } from '../jobs/queue';

const BCRYPT_ROUNDS = 10;

// ───── Per-account login rate limiting (in-memory, complements per-IP limiter) ─────

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_BACKOFF_WINDOW_MS = 15 * 60 * 1000;

function checkAccountRateLimit(email: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (!record) return true;
  if (now - record.lastAttempt > LOGIN_BACKOFF_WINDOW_MS) {
    loginAttempts.delete(email);
    return true;
  }
  return record.count < MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(email: string): void {
  const now = Date.now();
  const record = loginAttempts.get(email);
  if (!record || now - record.lastAttempt > LOGIN_BACKOFF_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
  } else {
    record.count++;
    record.lastAttempt = now;
  }
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ───── Refresh-token cookie helpers ─────

const REFRESH_COOKIE_NAME = 'refresh_token';

function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/auth',
    maxAge: config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/auth',
  });
}

// ───── Password validation (shared across activate/reset/change) ─────

const COMMON_PASSWORDS = new Set([
  'password1234', 'qwerty123456', '123456789012', 'abcdefghijkl',
  'password12345', 'admin1234567', 'letmein123456', 'welcome12345',
  'monkey1234567', 'dragon1234567', 'master1234567', 'changeme12345',
]);

export function validatePassword(password: string, user: { name: string; email: string }): string | null {
  if (typeof password !== 'string') return 'Password is required.';
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (password !== password.trim()) return 'Password must not have leading or trailing whitespace.';

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'This password is too common. Please choose a stronger one.';
  }

  if (/(.)\1{4,}/.test(password)) return 'Password must not contain long repeated character sequences.';
  const sequences = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i <= password.length - 5; i++) {
    const slice = password.slice(i, i + 5).toLowerCase();
    if (sequences.includes(slice)) return 'Password must not contain sequential characters.';
  }

  const emailLocal = user.email.split('@')[0].toLowerCase();
  if (emailLocal.length >= 3 && password.toLowerCase().includes(emailLocal)) {
    return 'Password must not contain your email address.';
  }
  const nameParts = user.name.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
  for (const part of nameParts) {
    if (password.toLowerCase().includes(part)) {
      return 'Password must not contain your name.';
    }
  }

  return null;
}

// ───── Refresh token issuance (shared by login and refresh) ─────

async function issueRefreshToken(
  res: Response,
  userId: string,
  familyId?: string,
  familyCreatedAt?: Date,
): Promise<void> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.jwt.refreshExpiryDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId,
      familyId: familyId || crypto.randomUUID(),
      familyCreatedAt: familyCreatedAt || now,
      expiresAt,
    },
  });

  setRefreshCookie(res, rawToken);
}

// ───── POST /auth/login ─────

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!checkAccountRateLimit(email)) {
    res.status(429).json({ success: false, error: 'Too many login attempts. Please try again later.' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || user.passwordHash === null) {
    recordFailedLogin(email);
    res.status(401).json({ success: false, error: 'Invalid email or password.' });
    return;
  }

  if (user.status !== 'ACTIVE') {
    recordFailedLogin(email);
    res.status(401).json({ success: false, error: 'Invalid email or password.' });
    return;
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    recordFailedLogin(email);
    res.status(401).json({ success: false, error: 'Invalid email or password.' });
    return;
  }

  clearLoginAttempts(email);

  const accessToken = signAccessToken(user.id, user.roleId);
  await issueRefreshToken(res, user.id);

  res.status(200).json({
    success: true,
    data: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    },
  });
}

// ───── POST /auth/refresh ─────

export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) {
    res.status(401).json({ success: false, error: 'Refresh token required.' });
    return;
  }

  const tokenHash = hashToken(rawToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (!existingToken) {
    clearRefreshCookie(res);
    res.status(401).json({ success: false, error: 'Invalid refresh token.' });
    return;
  }

  if (existingToken.revokedAt !== null) {
    const timeSinceRevocation = Date.now() - existingToken.revokedAt.getTime();
    const graceMs = config.jwt.refreshGraceWindowSeconds * 1000;

    let withinGrace = false;
    if (timeSinceRevocation <= graceMs) {
      const newerToken = await prisma.refreshToken.findFirst({
        where: {
          familyId: existingToken.familyId,
          revokedAt: null,
          createdAt: { gt: existingToken.createdAt },
        },
      });
      if (newerToken) {
        withinGrace = true;
      }
    }

    if (!withinGrace) {
      await prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { revokedAt: new Date() },
      });
      logger.warn('Refresh token replay detected, family revoked', {
        userId: existingToken.userId,
        familyId: existingToken.familyId,
      });
      clearRefreshCookie(res);
      res.status(401).json({ success: false, error: 'Session invalidated. Please log in again.' });
      return;
    }

    const accessToken = signAccessToken(existingToken.userId, existingToken.user.roleId);
    res.status(200).json({ success: true, data: { accessToken } });
    return;
  }

  if (existingToken.expiresAt < new Date()) {
    clearRefreshCookie(res);
    res.status(401).json({ success: false, error: 'Refresh token expired.' });
    return;
  }

  const ceilingMs = config.jwt.refreshAbsoluteCeilingDays * 24 * 60 * 60 * 1000;
  if (Date.now() - existingToken.familyCreatedAt.getTime() > ceilingMs) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existingToken.familyId },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
    return;
  }

  const revokeResult = await prisma.$transaction(async (tx) => {
    const updated = await tx.refreshToken.updateMany({
      where: { id: existingToken.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return updated.count;
  });

  if (revokeResult === 0) {
    await prisma.refreshToken.updateMany({
      where: { familyId: existingToken.familyId },
      data: { revokedAt: new Date() },
    });
    logger.warn('Concurrent refresh token rotation detected, family revoked', {
      userId: existingToken.userId,
      familyId: existingToken.familyId,
    });
    clearRefreshCookie(res);
    res.status(401).json({ success: false, error: 'Session invalidated. Please log in again.' });
    return;
  }

  await issueRefreshToken(
    res,
    existingToken.userId,
    existingToken.familyId,
    existingToken.familyCreatedAt,
  );

  const accessToken = signAccessToken(existingToken.userId, existingToken.user.roleId);
  res.status(200).json({ success: true, data: { accessToken } });
}

// ───── POST /auth/logout ─────

export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const token = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (token && token.revokedAt === null) {
      await prisma.refreshToken.updateMany({
        where: { familyId: token.familyId },
        data: { revokedAt: new Date() },
      });
    }
  }

  clearRefreshCookie(res);
  res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
}

// ───── POST /auth/activate ─────

export async function activate(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);

  const activationToken = await prisma.accountActivationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!activationToken || activationToken.usedAt !== null || activationToken.expiresAt < new Date()) {
    res.status(400).json({ success: false, error: 'Invalid or expired activation token.' });
    return;
  }

  if (activationToken.user.status !== 'PENDING') {
    res.status(400).json({ success: false, error: 'Account is already activated.' });
    return;
  }

  const passwordError = validatePassword(password, activationToken.user);
  if (passwordError) {
    res.status(400).json({ success: false, error: passwordError });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: activationToken.userId },
      data: { passwordHash, status: 'ACTIVE' },
    }),
    prisma.accountActivationToken.update({
      where: { id: activationToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: activationToken.userId,
        entityType: 'User',
        entityId: activationToken.userId,
        action: 'ACCOUNT_ACTIVATED',
        ipAddress: req.ip,
      },
    }),
  ]);

  res.status(200).json({ success: true, data: { message: 'Account activated successfully.' } });
}

// ───── POST /auth/resend-activation ─────

export async function resendActivation(req: Request, res: Response): Promise<void> {
  const genericResponse = { success: true, data: { message: 'If an account exists for this email, instructions have been sent.' } };
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'PENDING') {
    res.status(200).json(genericResponse);
    return;
  }

  await prisma.accountActivationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  await prisma.accountActivationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  logger.info('Activation token generated (email send pending)', { userId: user.id });

  // Queue activation email
  await queueActivationEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
    token: rawToken,
  });

  res.status(200).json(genericResponse);
}

// ───── POST /auth/forgot-password ─────

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const genericResponse = { success: true, data: { message: 'If an account exists for this email, instructions have been sent.' } };
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    res.status(200).json(genericResponse);
    return;
  }

  if (user.status === 'PENDING') {
    await prisma.accountActivationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    await prisma.accountActivationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    logger.info('Forgot-password for PENDING user → activation token generated', { userId: user.id });

    // Queue activation email for PENDING users
    await queueActivationEmail({
      userId: user.id,
      email: user.email,
      name: user.name,
      token: rawToken,
    });
  } else if (user.status === 'ACTIVE') {
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      },
    });

    logger.info('Password reset token generated', { userId: user.id });

    // Queue password reset email for ACTIVE users
    await queuePasswordResetEmail({
      userId: user.id,
      email: user.email,
      name: user.name,
      token: rawToken,
    });
  }

  res.status(200).json(genericResponse);
}

// ───── POST /auth/reset-password ─────

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < new Date()) {
    res.status(400).json({ success: false, error: 'Invalid or expired reset token.' });
    return;
  }

  const passwordError = validatePassword(password, resetToken.user);
  if (passwordError) {
    res.status(400).json({ success: false, error: passwordError });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash,
        status: resetToken.user.status === 'PENDING' ? 'ACTIVE' : resetToken.user.status,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: resetToken.userId,
        entityType: 'User',
        entityId: resetToken.userId,
        action: 'PASSWORD_RESET',
        newValues: { pendingToActive: resetToken.user.status === 'PENDING' },
        ipAddress: req.ip,
      },
    }),
  ]);

  res.status(200).json({ success: true, data: { message: 'Password reset successfully.' } });
}

// ───── POST /auth/change-password ─────

export async function changePassword(req: Request, res: Response): Promise<void> {
  const userId = req.user!.sub;
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.passwordHash === null) {
    res.status(400).json({ success: false, error: 'Unable to change password.' });
    return;
  }

  const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentValid) {
    res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    return;
  }

  const passwordError = validatePassword(newPassword, user);
  if (passwordError) {
    res.status(400).json({ success: false, error: passwordError });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId,
        entityType: 'User',
        entityId: userId,
        action: 'PASSWORD_CHANGED',
        ipAddress: req.ip,
      },
    }),
  ]);

  res.status(200).json({ success: true, data: { message: 'Password changed successfully. Please log in again.' } });
}
