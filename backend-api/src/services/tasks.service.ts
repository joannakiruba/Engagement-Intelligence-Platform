import prisma from '../lib/prisma';
import { DeadlineType } from '@prisma/client';

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export { ServiceError };

interface CreateTaskInput {
  title: string;
  description?: string;
  batchIds: string[];
  isMandatory: boolean;
  isInternal: boolean;
  maxMarks?: number;
  deadlineType: DeadlineType;
  deadline?: string;
  deadlineNote?: string;
}

export async function createTask(input: CreateTaskInput, createdById: string, scope: string) {
  const batches = await prisma.batch.findMany({
    where: { id: { in: input.batchIds } },
    select: { id: true },
  });

  const foundIds = new Set(batches.map((b) => b.id));
  const missing = input.batchIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new ServiceError(`Batches not found: ${missing.join(', ')}`, 404);
  }

  if (scope !== 'any') {
    const trainerBatches = await prisma.batchTrainer.findMany({
      where: { trainerId: createdById, batchId: { in: input.batchIds } },
      select: { batchId: true },
    });
    const authorizedBatchIds = new Set(trainerBatches.map((bt) => bt.batchId));
    const unauthorized = input.batchIds.filter((id) => !authorizedBatchIds.has(id));
    if (unauthorized.length > 0) {
      throw new ServiceError(
        `You are not a trainer for batches: ${unauthorized.join(', ')}`,
        403,
      );
    }
  }

  const deadlineDate = input.deadline ? new Date(input.deadline) : null;

  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description || null,
        isMandatory: input.isMandatory,
        isInternal: input.isInternal,
        maxMarks: input.isInternal ? input.maxMarks! : null,
        deadlineType: input.deadlineType,
        deadline: deadlineDate,
        deadlineNote: input.deadlineNote || null,
        createdById,
        taskBatches: {
          create: input.batchIds.map((batchId) => ({ batchId })),
        },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: {
          include: { batch: { select: { id: true, name: true } } },
        },
      },
    });

    if (input.deadlineType !== 'NONE') {
      await tx.taskDeadlineChange.create({
        data: {
          taskId: task.id,
          oldDeadlineType: 'NONE',
          newDeadlineType: input.deadlineType,
          oldDeadline: null,
          newDeadline: deadlineDate,
          reason: 'Initial deadline set at task creation',
          changedById: createdById,
        },
      });
    }

    let submissions: { id: string; taskId: string; studentId: string; progress: string }[] = [];

    if (input.isMandatory) {
      const batchMembers = await tx.batchMember.findMany({
        where: { batchId: { in: input.batchIds } },
        select: { studentId: true },
      });

      const uniqueStudentIds = [...new Set(batchMembers.map((bm) => bm.studentId))];

      if (uniqueStudentIds.length > 0) {
        await tx.taskSubmission.createMany({
          data: uniqueStudentIds.map((studentId) => ({
            taskId: task.id,
            studentId,
          })),
        });

        submissions = await tx.taskSubmission.findMany({
          where: { taskId: task.id },
          select: { id: true, taskId: true, studentId: true, progress: true },
        });
      }
    }

    return { task, submissions };
  });

  return {
    ...result.task,
    submissions: result.submissions,
    submissionCount: result.submissions.length,
  };
}
