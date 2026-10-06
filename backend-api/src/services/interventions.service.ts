import prisma from '../lib/prisma';
import { Prisma, InterventionStatus } from '@prisma/client';
import type { CauseCode } from '../validators/interventions.validator';
import { logger } from '../utils/logger';

const DbNull = Prisma.DbNull;

const interventionInclude = {
  student: { select: { id: true, name: true, email: true } },
  mentor: { select: { id: true, name: true, email: true } },
  outcome: true,
  tasks: { orderBy: { createdAt: 'asc' as const } },
  updates: { orderBy: { createdAt: 'desc' as const } },
  riskScore: { select: { id: true, totalScore: true, riskLevel: true, generatedAt: true } },
};

export async function findActiveIntervention(
  studentId: string,
  causeCode: string,
): Promise<{ id: string } | null> {
  return prisma.intervention.findFirst({
    where: {
      studentId,
      causeCode,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
    },
    select: { id: true },
  });
}

export async function createIntervention(data: {
  studentId: string;
  mentorId: string;
  alertId: number;
  causeCode: CauseCode;
  title: string;
  description: string;
  deadline?: Date;
  riskScoreId?: string;
  ipAddress?: string;
}) {
  const existing = await findActiveIntervention(data.studentId, data.causeCode);
  if (existing) {
    return { existing: true, intervention: await getInterventionById(existing.id) };
  }

  try {
    const intervention = await prisma.$transaction(async (tx) => {
      const created = await tx.intervention.create({
        data: {
          studentId: data.studentId,
          mentorId: data.mentorId,
          alertId: data.alertId,
          causeCode: data.causeCode,
          title: data.title,
          description: data.description || '',
          deadline: data.deadline,
          riskScoreId: data.riskScoreId,
          status: 'PENDING',
        },
        include: interventionInclude,
      });

      await tx.$queryRawUnsafe(
        `UPDATE ml_mentor_alerts SET alert_status = 'acted', acted_at = NOW() WHERE id = $1 AND alert_status != 'acted'`,
        data.alertId,
      );

      await tx.auditLog.create({
        data: {
          userId: data.mentorId,
          entityType: 'Intervention',
          entityId: created.id,
          action: 'INTERVENTION_CREATED',
          newValues: { alertId: data.alertId, causeCode: data.causeCode, title: data.title, studentId: data.studentId },
          ipAddress: data.ipAddress || null,
        },
      });

      return created;
    });
    return { existing: false, intervention };
  } catch (err: any) {
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (typeof target === 'string' && target.includes('interventions_student_cause_active_uq')
          || (Array.isArray(target) && target.some((t: string) => t.includes('interventions_student_cause_active_uq')))) {
        const existing = await findActiveIntervention(data.studentId, data.causeCode);
        if (existing) {
          return { existing: true, intervention: await getInterventionById(existing.id) };
        }
      }
    }
    throw err;
  }
}

export async function getInterventionById(id: string) {
  return prisma.intervention.findUnique({
    where: { id },
    include: interventionInclude,
  });
}

export interface ListInterventionsOpts {
  status?: InterventionStatus;
  studentId?: string;
  mentorId?: string;
  studentIds?: string[] | 'all';
  hasOverdueTasks?: boolean;
  page: number;
  limit: number;
}

export async function listInterventions(opts: ListInterventionsOpts) {
  const where: Prisma.InterventionWhereInput = {};

  if (opts.status) where.status = opts.status;
  if (opts.studentId) where.studentId = opts.studentId;
  if (opts.mentorId) where.mentorId = opts.mentorId;

  if (opts.studentIds && opts.studentIds !== 'all') {
    where.studentId = { in: opts.studentIds };
  }

  if (opts.hasOverdueTasks) {
    where.status = where.status ? where.status : { in: ['PENDING', 'IN_PROGRESS'] };
    where.tasks = {
      some: {
        isCompleted: false,
        deadline: { lt: new Date() },
      },
    };
  }

  const [interventions, total] = await Promise.all([
    prisma.intervention.findMany({
      where,
      include: interventionInclude,
      orderBy: { createdAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.intervention.count({ where }),
  ]);

  return { interventions, total };
}

export async function updateIntervention(
  id: string,
  mentorId: string,
  data: {
    title?: string;
    description?: string;
    deadline?: Date | null;
    status?: 'IN_PROGRESS' | 'CANCELLED';
  },
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const intervention = await tx.intervention.findUnique({
      where: { id },
      select: { status: true, mentorId: true, title: true, description: true, deadline: true },
    });
    if (!intervention) return null;
    if (intervention.mentorId !== mentorId) return null;
    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot modify a completed or cancelled intervention.');
    }

    const updateData: Prisma.InterventionUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    if (data.status) updateData.status = data.status;

    const updated = await tx.intervention.update({
      where: { id },
      data: updateData,
      include: interventionInclude,
    });

    await tx.auditLog.create({
      data: {
        userId: mentorId,
        entityType: 'Intervention',
        entityId: id,
        action: 'INTERVENTION_UPDATED',
        oldValues: { title: intervention.title, description: intervention.description, deadline: intervention.deadline, status: intervention.status },
        newValues: data,
        ipAddress: ipAddress || null,
      },
    });

    return updated;
  });
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export async function completeIntervention(
  interventionId: string,
  mentorId: string,
  outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED',
  remarks?: string,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const intervention = await tx.intervention.findUnique({
      where: { id: interventionId },
      select: { status: true, mentorId: true, alertId: true },
    });
    if (!intervention) return null;
    if (intervention.mentorId !== mentorId) return null;
    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      throw new ConflictError('Intervention is already terminal.');
    }

    await tx.intervention.update({
      where: { id: interventionId },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
    });

    await tx.interventionOutcome.create({
      data: {
        interventionId,
        outcome,
        remarks: remarks || null,
        recordedAt: now,
      },
    });

    if (intervention.alertId) {
      try {
        const alertRows = await tx.$queryRawUnsafe<Array<{ created_at: Date; acted_at: Date | null }>>(
          `SELECT created_at, acted_at FROM ml_mentor_alerts WHERE id = $1`,
          intervention.alertId,
        );
        const responseTimeHours = alertRows.length && alertRows[0].acted_at
          ? (new Date(alertRows[0].acted_at).getTime() - new Date(alertRows[0].created_at).getTime()) / 3_600_000
          : null;

        await tx.$queryRawUnsafe(
          `INSERT INTO ml_alert_outcomes (alert_id, mentor_response, intervention_id, was_recommendation_followed, response_time_hours, outcome_notes)
           VALUES ($1, 'acted', $2, NULL, $3, $4)
           ON CONFLICT (alert_id, intervention_id) WHERE intervention_id IS NOT NULL DO NOTHING`,
          intervention.alertId,
          interventionId,
          responseTimeHours,
          remarks || null,
        );
      } catch (err) {
        logger.error(`Failed to record alert outcome for alertId=${intervention.alertId}: ${err}`);
      }
    }

    await tx.auditLog.create({
      data: {
        userId: mentorId,
        entityType: 'Intervention',
        entityId: interventionId,
        action: 'INTERVENTION_COMPLETED',
        newValues: { outcome, remarks: remarks || null },
        ipAddress: ipAddress || null,
      },
    });

    return tx.intervention.findUnique({
      where: { id: interventionId },
      include: interventionInclude,
    });
  });
}

export async function editOutcome(
  interventionId: string,
  outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED',
  remarks?: string,
  opts?: { alertId?: number | null; mentorId?: string; ipAddress?: string },
) {
  return prisma.$transaction(async (tx) => {
    const oldOutcome = await tx.interventionOutcome.findUnique({
      where: { interventionId },
    });

    const updated = await tx.interventionOutcome.update({
      where: { interventionId },
      data: {
        outcome,
        remarks: remarks || null,
      },
    });

    if (opts?.alertId) {
      await tx.$queryRawUnsafe(
        `UPDATE ml_alert_outcomes SET outcome_notes = $1 WHERE alert_id = $2 AND intervention_id = $3`,
        remarks || null,
        opts.alertId,
        interventionId,
      );
    }

    if (opts?.mentorId) {
      await tx.auditLog.create({
        data: {
          userId: opts.mentorId,
          entityType: 'InterventionOutcome',
          entityId: interventionId,
          action: 'INTERVENTION_OUTCOME_EDITED',
          oldValues: oldOutcome ? { outcome: oldOutcome.outcome, remarks: oldOutcome.remarks } : DbNull,
          newValues: { outcome, remarks: remarks || null },
          ipAddress: opts.ipAddress || null,
        },
      });
    }

    return updated;
  });
}

// ── Tasks ──

export async function createTask(
  interventionId: string,
  mentorId: string,
  data: { title: string; description?: string; deadline?: Date | null },
) {
  return prisma.$transaction(async (tx) => {
    const intervention = await tx.intervention.findUnique({
      where: { id: interventionId },
      select: { status: true, mentorId: true },
    });
    if (!intervention) return null;
    if (intervention.mentorId !== mentorId) return null;
    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot add tasks to a terminal intervention.');
    }

    return tx.interventionTask.create({
      data: {
        interventionId,
        title: data.title,
        description: data.description || null,
        deadline: data.deadline || null,
      },
    });
  });
}

export async function updateTask(
  taskId: string,
  mentorId: string,
  data: { title?: string; description?: string; deadline?: Date | null; isCompleted?: boolean },
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.interventionTask.findUnique({
      where: { id: taskId },
      include: { intervention: { select: { id: true, mentorId: true, status: true } } },
    });
    if (!task) return null;
    if (task.intervention.mentorId !== mentorId) return null;
    if (task.intervention.status === 'COMPLETED' || task.intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot modify tasks on a terminal intervention.');
    }

    const updateData: Prisma.InterventionTaskUpdateInput = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description || null;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;
    if (data.isCompleted !== undefined) {
      updateData.isCompleted = data.isCompleted;
      updateData.completedAt = data.isCompleted ? new Date() : null;
    }
    return tx.interventionTask.update({
      where: { id: taskId },
      data: updateData,
    });
  });
}

export async function getTaskById(taskId: string) {
  return prisma.interventionTask.findUnique({
    where: { id: taskId },
    include: { intervention: { select: { id: true, mentorId: true, studentId: true, status: true } } },
  });
}

// ── Notes ──

export async function createNote(
  interventionId: string,
  mentorId: string,
  note: string,
) {
  return prisma.$transaction(async (tx) => {
    const intervention = await tx.intervention.findUnique({
      where: { id: interventionId },
      select: { status: true, mentorId: true },
    });
    if (!intervention) return null;
    if (intervention.mentorId !== mentorId) return null;
    if (intervention.status === 'COMPLETED' || intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot add notes to a terminal intervention.');
    }

    return tx.interventionUpdate.create({
      data: { interventionId, note },
    });
  });
}

export async function updateNote(
  noteId: string,
  mentorId: string,
  note: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interventionUpdate.findUnique({
      where: { id: noteId },
      include: { intervention: { select: { mentorId: true, status: true } } },
    });
    if (!existing) return null;
    if (existing.intervention.mentorId !== mentorId) return null;
    if (existing.intervention.status === 'COMPLETED' || existing.intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot modify notes on a completed or cancelled intervention.');
    }

    return tx.interventionUpdate.update({
      where: { id: noteId },
      data: { note, editedAt: new Date() },
    });
  });
}

export async function deleteNote(
  noteId: string,
  mentorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.interventionUpdate.findUnique({
      where: { id: noteId },
      include: { intervention: { select: { mentorId: true, status: true } } },
    });
    if (!existing) return null;
    if (existing.intervention.mentorId !== mentorId) return null;
    if (existing.intervention.status === 'COMPLETED' || existing.intervention.status === 'CANCELLED') {
      throw new ConflictError('Cannot delete notes on a completed or cancelled intervention.');
    }

    return tx.interventionUpdate.delete({ where: { id: noteId } });
  });
}

export async function getNoteById(noteId: string) {
  return prisma.interventionUpdate.findUnique({
    where: { id: noteId },
    include: { intervention: { select: { id: true, mentorId: true, studentId: true, status: true } } },
  });
}

export async function getPendingCount(mentorId: string): Promise<number> {
  return prisma.intervention.count({
    where: { mentorId, status: 'PENDING' },
  });
}
