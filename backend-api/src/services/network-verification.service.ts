import crypto from 'crypto';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { Request } from 'express';
import { FlagReason } from '@prisma/client';

// --- Platform mode ---
// 'browser' uses public IP matching; 'native' uses BSSID (WiFi access point).
// Flip this when packaging as a mobile/desktop app.
const PLATFORM_MODE: 'browser' | 'native' = 'browser';

// --- IP helpers ---

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

// --- Network fingerprint ---
// In browser mode this is the public IP; in native mode it will be the BSSID.

export interface NetworkInfo {
  ip: string;
  bssid?: string;
  ssid?: string;
}

export function getNetworkFingerprint(info: NetworkInfo): string {
  if (PLATFORM_MODE === 'native' && info.bssid) {
    return info.bssid.toUpperCase();
  }
  return info.ip;
}

export function verifyNetworkMatch(trainerFingerprint: string | null, studentFingerprint: string): boolean {
  if (!trainerFingerprint) return true;
  return trainerFingerprint === studentFingerprint;
}

// --- Device token ---

const DEVICE_COOKIE_NAME = 'eip_device_token';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

export function generateDeviceTokenValue(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashDeviceToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function getDeviceCookieName(): string {
  return DEVICE_COOKIE_NAME;
}

export function getDeviceCookieMaxAge(): number {
  return DEVICE_COOKIE_MAX_AGE;
}

export async function resolveDeviceToken(
  rawToken: string | undefined,
  studentId: string,
  userAgent: string | undefined
): Promise<{ deviceTokenId: string; flags: FlagReason[] }> {
  const flags: FlagReason[] = [];

  if (!rawToken) {
    // First visit or cleared cookies — create a new token
    const newRaw = generateDeviceTokenValue();
    const record = await prisma.deviceToken.create({
      data: {
        tokenHash: hashDeviceToken(newRaw),
        studentId,
        userAgent: userAgent?.slice(0, 512),
      },
    });
    return { deviceTokenId: record.id, flags };
  }

  const tokenHash = hashDeviceToken(rawToken);
  const existing = await prisma.deviceToken.findUnique({ where: { tokenHash } });

  if (!existing) {
    // Token not in DB (tampered or DB was reset) — issue a new one, soft flag
    const newRaw = generateDeviceTokenValue();
    const record = await prisma.deviceToken.create({
      data: {
        tokenHash: hashDeviceToken(newRaw),
        studentId,
        userAgent: userAgent?.slice(0, 512),
      },
    });
    flags.push('DEVICE_RESET');
    return { deviceTokenId: record.id, flags };
  }

  if (existing.studentId !== studentId) {
    // Different student using the same device — hard conflict
    flags.push('DEVICE_CONFLICT');
    return { deviceTokenId: existing.id, flags };
  }

  return { deviceTokenId: existing.id, flags };
}

// --- Flag creation ---

export async function createAttendanceFlag(
  attendanceId: string,
  studentId: string,
  reason: FlagReason,
  details?: string
) {
  return prisma.attendanceFlag.create({
    data: { attendanceId, studentId, reason, details },
  });
}

// --- Flag queries ---

export async function getFlags(filters?: {
  status?: string;
  batchId?: string;
  from?: string;
  to?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filters?.status) where.status = filters.status;

  if (filters?.batchId || filters?.from || filters?.to) {
    const attendanceFilter: Record<string, unknown> = {};
    if (filters.batchId || filters.from || filters.to) {
      const sessionFilter: Record<string, unknown> = {};
      if (filters.batchId) sessionFilter.batchId = filters.batchId;
      if (filters.from || filters.to) {
        sessionFilter.scheduledDate = {};
        if (filters.from) (sessionFilter.scheduledDate as Record<string, unknown>).gte = new Date(filters.from);
        if (filters.to) (sessionFilter.scheduledDate as Record<string, unknown>).lte = new Date(filters.to);
      }
      attendanceFilter.session = sessionFilter;
    }
    where.attendance = attendanceFilter;
  }

  return prisma.attendanceFlag.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, email: true } },
      attendance: {
        select: {
          id: true,
          windowId: true,
          studentIp: true,
          networkFingerprint: true,
          checkInTime: true,
          session: { select: { id: true, title: true, scheduledDate: true } },
          window: { select: { id: true, label: true, trainerIp: true, networkFingerprint: true } },
        },
      },
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resolveFlag(
  flagId: string,
  status: 'CONFIRMED_FRAUD' | 'DISMISSED',
  reviewerId: string
) {
  const flag = await prisma.attendanceFlag.findUnique({ where: { id: flagId } });
  if (!flag) return null;

  const updated = await prisma.attendanceFlag.update({
    where: { id: flagId },
    data: { status, reviewedBy: reviewerId, resolvedAt: new Date() },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  // If confirmed fraud, mark the attendance as ABSENT
  if (status === 'CONFIRMED_FRAUD') {
    await prisma.attendance.update({
      where: { id: flag.attendanceId },
      data: { status: 'ABSENT', remarks: `Marked absent — attendance flag #${flagId} confirmed as fraud` },
    });
  }

  return updated;
}

export async function getFlagStats() {
  const [pending, confirmed, dismissed] = await Promise.all([
    prisma.attendanceFlag.count({ where: { status: 'PENDING' } }),
    prisma.attendanceFlag.count({ where: { status: 'CONFIRMED_FRAUD' } }),
    prisma.attendanceFlag.count({ where: { status: 'DISMISSED' } }),
  ]);
  return { pending, confirmed, dismissed, total: pending + confirmed + dismissed };
}
