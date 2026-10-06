import prisma from '../lib/prisma';
import { Prisma, InterventionStatus } from '@prisma/client';
import type { CauseCode } from '../validators/interventions.validator';

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
}) {
  const existing = await findActiveIntervention(data.studentId, data.causeCode);
  if (existing) {
    return { existing: true, intervention: await getInterventionById(existing.id) };
  }

  try {
    const intervention = await prisma.intervention.create({
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
    return { existing: false, intervention };
  } catch (err: any) {
    if (err.code === 'P2002' && err.meta?.target?.includes('interventions_student_cause_active_uq')) {
      const existing = await findActiveIntervention(data.studentId, data.causeCode);
      if (existing) {
        return { existing: true, intervention: await getInterventionById(existing.id) };
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
  data: {
    title?: string;
    description?: string;
    deadline?: Date | null;
    status?: 'IN_PROGRESS' | 'CANCELLED';
  },
) {
  const updateData: Prisma.InterventionUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.deadline !== undefined) updateData.deadline = data.deadline;
  if (data.status) updateData.status = data.status;

  return prisma.intervention.update({
    where: { id },
    data: updateData,
    include: interventionInclude,
  });
}

export async function completeIntervention(
  interventionId: string,
  outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED',
  remarks?: string,
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const intervention = await tx.intervention.update({
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
) {
  return prisma.interventionOutcome.update({
    where: { interventionId },
    data: {
      outcome,
      remarks: remarks || null,
    },
  });
}

// ── Tasks ──

export async function createTask(
  interventionId: string,
  data: { title: string; description?: string; deadline?: Date | null },
) {
  return prisma.interventionTask.create({
    data: {
      interventionId,
      title: data.title,
      description: data.description || null,
      deadline: data.deadline || null,
    },
  });
}

export async function updateTask(
  taskId: string,
  data: { title?: string; description?: string; deadline?: Date | null; isCompleted?: boolean },
) {
  const updateData: Prisma.InterventionTaskUpdateInput = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.deadline !== undefined) updateData.deadline = data.deadline;
  if (data.isCompleted !== undefined) {
    updateData.isCompleted = data.isCompleted;
    updateData.completedAt = data.isCompleted ? new Date() : null;
  }
  return prisma.interventionTask.update({
    where: { id: taskId },
    data: updateData,
  });
}

export async function getTaskById(taskId: string) {
  return prisma.interventionTask.findUnique({
    where: { id: taskId },
    include: { intervention: { select: { id: true, mentorId: true, studentId: true, status: true } } },
  });
}

// ── Notes ──

export async function createNote(interventionId: string, note: string) {
  return prisma.interventionUpdate.create({
    data: { interventionId, note },
  });
}

export async function updateNote(noteId: string, note: string) {
  return prisma.interventionUpdate.update({
    where: { id: noteId },
    data: { note, editedAt: new Date() },
  });
}

export async function deleteNote(noteId: string) {
  return prisma.interventionUpdate.delete({ where: { id: noteId } });
}

export async function getNoteById(noteId: string) {
  return prisma.interventionUpdate.findUnique({
    where: { id: noteId },
    include: { intervention: { select: { id: true, mentorId: true, studentId: true } } },
  });
}

export async function getPendingCount(mentorId: string): Promise<number> {
  return prisma.intervention.count({
    where: { mentorId, status: 'PENDING' },
  });
}
