import prisma from '../lib/prisma';
import { DeadlineType, Prisma } from '@prisma/client';

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

interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  isMandatory?: boolean;
  isInternal?: boolean;
  maxMarks?: number | null;
  addBatchIds?: string[];
}

async function notifyStudents(
  tx: Prisma.TransactionClient,
  taskId: string,
  taskTitle: string,
  message: string,
) {
  const submissions = await tx.taskSubmission.findMany({
    where: { taskId },
    select: { studentId: true },
  });

  if (submissions.length === 0) return;

  await tx.notification.createMany({
    data: submissions.map((s) => ({
      userId: s.studentId,
      title: `Task Updated: ${taskTitle}`,
      message,
      type: 'TASK_UPDATE' as const,
    })),
  });
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
  updatedById: string,
  scope: string,
) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      taskBatches: { select: { batchId: true } },
    },
  });

  if (!existing) {
    throw new ServiceError('Task not found', 404);
  }

  if (existing.closedAt) {
    throw new ServiceError('Cannot edit a closed task', 409);
  }

  if (scope !== 'any') {
    const existingBatchIds = existing.taskBatches.map((tb) => tb.batchId);
    const trainerBatches = await prisma.batchTrainer.findMany({
      where: { trainerId: updatedById, batchId: { in: existingBatchIds } },
      select: { batchId: true },
    });
    if (trainerBatches.length === 0) {
      throw new ServiceError('You are not a trainer for any of this task\'s batches', 403);
    }
  }

  const resolvedIsInternal = input.isInternal ?? existing.isInternal;
  const resolvedMaxMarks = input.maxMarks !== undefined ? input.maxMarks : existing.maxMarks;

  if (resolvedIsInternal && (resolvedMaxMarks === null || resolvedMaxMarks === undefined)) {
    throw new ServiceError('maxMarks is required when isInternal is true', 400);
  }

  if (input.isInternal === false && existing.isInternal) {
    const hasGrades = await prisma.taskSubmission.findFirst({
      where: { taskId, marksAwarded: { not: null } },
    });
    if (hasGrades) {
      throw new ServiceError(
        'Cannot disable isInternal: students already have marks awarded. Remove marks first.',
        409,
      );
    }
  }

  if (resolvedIsInternal && resolvedMaxMarks !== null && resolvedMaxMarks !== undefined) {
    if (existing.maxMarks !== null && resolvedMaxMarks < existing.maxMarks) {
      const exceeded = await prisma.taskSubmission.findFirst({
        where: { taskId, marksAwarded: { gt: resolvedMaxMarks } },
      });
      if (exceeded) {
        throw new ServiceError(
          `Cannot lower maxMarks to ${resolvedMaxMarks}: at least one student has marksAwarded above this value`,
          409,
        );
      }
    }
  }

  if (input.addBatchIds && input.addBatchIds.length > 0) {
    const existingBatchIdSet = new Set(existing.taskBatches.map((tb) => tb.batchId));
    const trulyNew = input.addBatchIds.filter((id) => !existingBatchIdSet.has(id));

    if (trulyNew.length > 0) {
      const batches = await prisma.batch.findMany({
        where: { id: { in: trulyNew } },
        select: { id: true },
      });
      const foundIds = new Set(batches.map((b) => b.id));
      const missing = trulyNew.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new ServiceError(`Batches not found: ${missing.join(', ')}`, 404);
      }

      if (scope !== 'any') {
        const trainerBatches = await prisma.batchTrainer.findMany({
          where: { trainerId: updatedById, batchId: { in: trulyNew } },
          select: { batchId: true },
        });
        const authorizedIds = new Set(trainerBatches.map((bt) => bt.batchId));
        const unauthorized = trulyNew.filter((id) => !authorizedIds.has(id));
        if (unauthorized.length > 0) {
          throw new ServiceError(
            `You are not a trainer for batches: ${unauthorized.join(', ')}`,
            403,
          );
        }
      }
    }
  }

  const resolvedIsMandatory = input.isMandatory ?? existing.isMandatory;

  const result = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isMandatory !== undefined) updateData.isMandatory = input.isMandatory;
    if (input.isInternal !== undefined) {
      updateData.isInternal = input.isInternal;
      if (!input.isInternal) {
        updateData.maxMarks = null;
      }
    }
    if (input.maxMarks !== undefined && resolvedIsInternal) {
      updateData.maxMarks = input.maxMarks;
    }

    const task = await tx.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: {
          include: { batch: { select: { id: true, name: true } } },
        },
      },
    });

    let newSubmissionCount = 0;

    if (input.addBatchIds && input.addBatchIds.length > 0) {
      const existingBatchIdSet = new Set(existing.taskBatches.map((tb) => tb.batchId));
      const trulyNew = input.addBatchIds.filter((id) => !existingBatchIdSet.has(id));

      if (trulyNew.length > 0) {
        await tx.taskBatch.createMany({
          data: trulyNew.map((batchId) => ({ taskId, batchId })),
        });

        if (resolvedIsMandatory) {
          const newMembers = await tx.batchMember.findMany({
            where: { batchId: { in: trulyNew } },
            select: { studentId: true },
          });
          const existingSubs = await tx.taskSubmission.findMany({
            where: { taskId },
            select: { studentId: true },
          });
          const existingStudentIds = new Set(existingSubs.map((s) => s.studentId));
          const newStudentIds = [...new Set(newMembers.map((m) => m.studentId))]
            .filter((id) => !existingStudentIds.has(id));

          if (newStudentIds.length > 0) {
            await tx.taskSubmission.createMany({
              data: newStudentIds.map((studentId) => ({ taskId, studentId })),
            });
            newSubmissionCount = newStudentIds.length;
          }
        }
      }
    }

    if (input.isMandatory === true && !existing.isMandatory) {
      const allBatchIds = (await tx.taskBatch.findMany({
        where: { taskId },
        select: { batchId: true },
      })).map((tb) => tb.batchId);

      const allMembers = await tx.batchMember.findMany({
        where: { batchId: { in: allBatchIds } },
        select: { studentId: true },
      });
      const existingSubs = await tx.taskSubmission.findMany({
        where: { taskId },
        select: { studentId: true },
      });
      const existingStudentIds = new Set(existingSubs.map((s) => s.studentId));
      const missingStudentIds = [...new Set(allMembers.map((m) => m.studentId))]
        .filter((id) => !existingStudentIds.has(id));

      if (missingStudentIds.length > 0) {
        await tx.taskSubmission.createMany({
          data: missingStudentIds.map((studentId) => ({ taskId, studentId })),
        });
        newSubmissionCount += missingStudentIds.length;
      }
    }

    const taskTitle = input.title ?? existing.title;
    const changes: string[] = [];
    if (input.title !== undefined) changes.push('title');
    if (input.description !== undefined) changes.push('description');
    if (input.isMandatory !== undefined) changes.push(`mandatory: ${input.isMandatory}`);
    if (input.isInternal !== undefined) changes.push(`internal: ${input.isInternal}`);
    if (input.maxMarks !== undefined) changes.push(`maxMarks: ${input.maxMarks}`);
    if (newSubmissionCount > 0) changes.push(`${newSubmissionCount} new students added`);

    if (changes.length > 0) {
      await notifyStudents(tx, taskId, taskTitle, `Task updated: ${changes.join(', ')}`);
    }

    const updatedTask = await tx.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: {
          include: { batch: { select: { id: true, name: true } } },
        },
        submissions: {
          select: { id: true, taskId: true, studentId: true, progress: true },
        },
      },
    });

    return updatedTask;
  });

  return result;
}
