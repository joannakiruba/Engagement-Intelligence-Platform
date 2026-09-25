import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export function requirePermission(...requiredCodes: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const { roleId } = req.user;

    const matchingPermissions = await prisma.rolePermission.findMany({
      where: {
        roleId,
        permission: { code: { in: requiredCodes } },
      },
      include: { permission: true },
    });

    const heldCodes = new Set(matchingPermissions.map((rp) => rp.permission.code));

    const hasPermission = requiredCodes.some((code) => heldCodes.has(code));

    if (!hasPermission) {
      res.status(403).json({ success: false, error: 'Insufficient permissions.' });
      return;
    }

    (req as any).heldPermissions = heldCodes;
    next();
  };
}

export type ResolvedScope =
  | 'any'
  | 'assigned'
  | 'batch'
  | 'own'
  | 'self'
  | 'own_given'
  | 'own_received'
  | 'category_batch'
  | 'none';

const SCOPE_PRIORITY: ResolvedScope[] = [
  'any',
  'assigned',
  'batch',
  'own_given',
  'own_received',
  'own',
  'self',
  'category_batch',
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

export function resolveScope(resource: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const heldPermissions: Set<string> = (req as any).heldPermissions || new Set();

    let scope: ResolvedScope = 'none';

    for (const candidate of SCOPE_PRIORITY) {
      for (const code of heldPermissions) {
        if (codeMatchesScope(code, resource, candidate)) {
          scope = candidate;
          break;
        }
      }
      if (scope !== 'none') break;
    }

    // Unsuffixed permissions (e.g. users:create, users:activate) — the permission
    // check alone is sufficient; treat as unrestricted for scope purposes.
    if (scope === 'none') {
      for (const code of heldPermissions) {
        if (code.startsWith(`${resource}:`)) {
          scope = 'any';
          break;
        }
      }
    }

    (req as any).resolvedScope = scope;
    next();
  };
}

export async function enforceScopeForUser(
  req: Request,
  targetUserId: string,
): Promise<boolean> {
  const scope: ResolvedScope = (req as any).resolvedScope || 'none';
  const requesterId = req.user!.sub;

  switch (scope) {
    case 'any':
      return true;

    case 'self':
    case 'own':
    case 'own_given':
    case 'own_received':
      return targetUserId === requesterId;

    case 'assigned': {
      const assignment = await prisma.mentorAssignment.findUnique({
        where: {
          mentorId_studentId: { mentorId: requesterId, studentId: targetUserId },
        },
      });
      return assignment !== null;
    }

    case 'batch':
    case 'category_batch': {
      const trainerBatches = await prisma.batchTrainer.findMany({
        where: { trainerId: requesterId },
        select: { batchId: true },
      });
      if (trainerBatches.length === 0) return false;

      const batchIds = trainerBatches.map((bt) => bt.batchId);
      const membership = await prisma.batchMember.findFirst({
        where: {
          studentId: targetUserId,
          batchId: { in: batchIds },
        },
      });
      return membership !== null;
    }

    default:
      return false;
  }
}

export async function getScopedStudentIds(req: Request): Promise<string[] | 'all'> {
  const scope: ResolvedScope = (req as any).resolvedScope || 'none';
  const requesterId = req.user!.sub;

  switch (scope) {
    case 'any':
      return 'all';

    case 'self':
    case 'own':
    case 'own_received':
    case 'own_given':
      return [requesterId];

    case 'assigned': {
      const assignments = await prisma.mentorAssignment.findMany({
        where: { mentorId: requesterId },
        select: { studentId: true },
      });
      return assignments.map((a) => a.studentId);
    }

    case 'batch':
    case 'category_batch': {
      const trainerBatches = await prisma.batchTrainer.findMany({
        where: { trainerId: requesterId },
        select: { batchId: true },
      });
      if (trainerBatches.length === 0) return [];

      const batchIds = trainerBatches.map((bt) => bt.batchId);
      const members = await prisma.batchMember.findMany({
        where: { batchId: { in: batchIds } },
        select: { studentId: true },
      });
      return members.map((m) => m.studentId);
    }

    default:
      return [];
  }
}

export async function getScopedBatchIds(req: Request): Promise<string[] | 'all'> {
  const scope: ResolvedScope = (req as any).resolvedScope || 'none';
  const requesterId = req.user!.sub;

  switch (scope) {
    case 'any':
      return 'all';

    case 'own':
    case 'self': {
      const memberships = await prisma.batchMember.findMany({
        where: { studentId: requesterId },
        select: { batchId: true },
      });
      const trainerBatches = await prisma.batchTrainer.findMany({
        where: { trainerId: requesterId },
        select: { batchId: true },
      });
      return [...new Set([
        ...memberships.map((m) => m.batchId),
        ...trainerBatches.map((t) => t.batchId),
      ])];
    }

    case 'batch':
    case 'category_batch': {
      const trainerBatches = await prisma.batchTrainer.findMany({
        where: { trainerId: requesterId },
        select: { batchId: true },
      });
      return trainerBatches.map((t) => t.batchId);
    }

    case 'assigned': {
      const assignments = await prisma.mentorAssignment.findMany({
        where: { mentorId: requesterId },
        select: { studentId: true },
      });
      const studentIds = assignments.map((a) => a.studentId);
      if (studentIds.length === 0) return [];

      const memberships = await prisma.batchMember.findMany({
        where: { studentId: { in: studentIds } },
        select: { batchId: true },
      });
      return [...new Set(memberships.map((m) => m.batchId))];
    }

    default:
      return [];
  }
}
