import prisma from '../lib/prisma';
import type { OutcomeType } from '@prisma/client';

export class ServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

const INTERVENTION_INCLUDE = {
  student: { select: { id: true, name: true, email: true } },
  mentor: { select: { id: true, name: true, email: true } },
  riskScore: { select: { id: true, totalScore: true, riskLevel: true } },
  updates: { orderBy: { createdAt: 'desc' as const } },
  outcome: true,
};

export async function createIntervention(
  mentorId: string,
  data: {
    studentId: string;
    riskScoreId?: string;
    title: string;
    description: string;
    deadline?: string;
  },
) {
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { mentorId_studentId: { mentorId, studentId: data.studentId } },
  });
  if (!assignment) {
    throw new ServiceError(403, 'You can only create interventions for your assigned students');
  }

  return prisma.intervention.create({
    data: {
      studentId: data.studentId,
      mentorId,
      riskScoreId: data.riskScoreId || null,
      title: data.title,
      description: data.description,
      deadline: data.deadline ? new Date(data.deadline) : null,
    },
    include: INTERVENTION_INCLUDE,
  });
}

export async function listInterventions(
  userId: string,
  heldPermissions: Set<string>,
  filters?: { studentId?: string; status?: string },
) {
  const where: Record<string, unknown> = {};

  if (heldPermissions.has('interventions:read:any')) {
    // no scope filter
  } else if (heldPermissions.has('interventions:read:assigned')) {
    where.mentorId = userId;
  } else {
    where.studentId = userId;
  }

  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.status) where.status = filters.status;

  return prisma.intervention.findMany({
    where,
    include: INTERVENTION_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getInterventionById(id: string) {
  const intervention = await prisma.intervention.findUnique({
    where: { id },
    include: INTERVENTION_INCLUDE,
  });
  if (!intervention) throw new ServiceError(404, 'Intervention not found');
  return intervention;
}

export async function updateIntervention(
  mentorId: string,
  id: string,
  updates: { title?: string; description?: string; status?: string; deadline?: string | null },
) {
  const existing = await prisma.intervention.findUnique({ where: { id } });
  if (!existing) throw new ServiceError(404, 'Intervention not found');
  if (existing.mentorId !== mentorId) {
    throw new ServiceError(403, 'You can only update interventions you created');
  }

  const data: Record<string, unknown> = {};
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.deadline !== undefined) data.deadline = updates.deadline ? new Date(updates.deadline) : null;

  return prisma.intervention.update({
    where: { id },
    data,
    include: INTERVENTION_INCLUDE,
  });
}

export async function addProgressNote(mentorId: string, interventionId: string, note: string) {
  const intervention = await prisma.intervention.findUnique({ where: { id: interventionId } });
  if (!intervention) throw new ServiceError(404, 'Intervention not found');
  if (intervention.mentorId !== mentorId) {
    throw new ServiceError(403, 'You can only add notes to interventions you created');
  }

  return prisma.interventionUpdate.create({
    data: { interventionId, note },
  });
}

export async function logOutcome(
  mentorId: string,
  interventionId: string,
  outcome: string,
  remarks?: string,
) {
  const intervention = await prisma.intervention.findUnique({
    where: { id: interventionId },
    include: { outcome: true },
  });
  if (!intervention) throw new ServiceError(404, 'Intervention not found');
  if (intervention.mentorId !== mentorId) {
    throw new ServiceError(403, 'You can only log outcomes for interventions you created');
  }
  if (intervention.outcome) {
    throw new ServiceError(409, 'Outcome already recorded for this intervention');
  }

  const result = await prisma.interventionOutcome.create({
    data: {
      interventionId,
      outcome: outcome as OutcomeType,
      remarks: remarks || null,
    },
  });

  await prisma.intervention.update({
    where: { id: interventionId },
    data: { status: 'COMPLETED' },
  });

  return result;
}
