import prisma from '../lib/prisma';
import { DeadlineType, Prisma, TaskProgress } from '@prisma/client';

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

interface ListTasksFilters {
  batchId?: string;
  isMandatory?: boolean;
  isInternal?: boolean;
  deadlineType?: DeadlineType;
  status?: 'open' | 'closed';
  search?: string;
  page?: number;
  limit?: number;
}

export async function listTasks(
  filters: ListTasksFilters,
  requesterId: string,
  scope: string,
) {
  const where: Prisma.TaskWhereInput = {};

  if (scope !== 'any') {
    const trainerBatches = await prisma.batchTrainer.findMany({
      where: { trainerId: requesterId },
      select: { batchId: true },
    });
    const trainerBatchIds = trainerBatches.map((tb) => tb.batchId);

    if (filters.batchId) {
      if (!trainerBatchIds.includes(filters.batchId)) {
        return { data: [], total: 0, page: filters.page ?? 1, limit: filters.limit ?? 20 };
      }
      where.taskBatches = { some: { batchId: filters.batchId } };
    } else {
      where.taskBatches = { some: { batchId: { in: trainerBatchIds } } };
    }
  } else if (filters.batchId) {
    where.taskBatches = { some: { batchId: filters.batchId } };
  }

  if (filters.isMandatory !== undefined) where.isMandatory = filters.isMandatory;
  if (filters.isInternal !== undefined) where.isInternal = filters.isInternal;
  if (filters.deadlineType) where.deadlineType = filters.deadlineType;

  if (filters.status === 'open') {
    where.closedAt = null;
  } else if (filters.status === 'closed') {
    where.closedAt = { not: null };
  }

  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: {
          include: { batch: { select: { id: true, name: true } } },
        },
        submissions: {
          select: { progress: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.task.count({ where }),
  ]);

  const data = tasks.map((task) => {
    const progressCounts: Record<string, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      ALMOST_COMPLETED: 0,
      COMPLETED: 0,
    };
    for (const sub of task.submissions) {
      progressCounts[sub.progress] = (progressCounts[sub.progress] || 0) + 1;
    }

    const { submissions, ...taskFields } = task;
    return {
      ...taskFields,
      submissionCount: submissions.length,
      progressCounts,
    };
  });

  return { data, total, page, limit };
}

export async function getTaskById(
  taskId: string,
  requesterId: string,
  scope: string,
  progressFilter?: TaskProgress,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      taskBatches: {
        include: { batch: { select: { id: true, name: true } } },
      },
      submissions: {
        where: progressFilter ? { progress: progressFilter } : undefined,
        include: {
          student: { select: { id: true, name: true, email: true } },
          gradedBy: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      deadlineChanges: {
        include: { changedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    throw new ServiceError('Task not found', 404);
  }

  if (scope !== 'any') {
    const taskBatchIds = task.taskBatches.map((tb) => tb.batchId);
    const trainerBatch = await prisma.batchTrainer.findFirst({
      where: { trainerId: requesterId, batchId: { in: taskBatchIds } },
    });
    if (!trainerBatch) {
      throw new ServiceError('You are not a trainer for any of this task\'s batches', 403);
    }
  }

  const progressCounts: Record<string, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    ALMOST_COMPLETED: 0,
    COMPLETED: 0,
  };

  const allSubmissions = progressFilter
    ? await prisma.taskSubmission.findMany({
        where: { taskId },
        select: { progress: true },
      })
    : task.submissions;

  for (const sub of allSubmissions) {
    progressCounts[sub.progress] = (progressCounts[sub.progress] || 0) + 1;
  }

  return {
    ...task,
    submissionCount: allSubmissions.length,
    progressCounts,
  };
}

interface ChangeDeadlineInput {
  deadlineType: DeadlineType;
  deadline?: string;
  deadlineNote?: string;
  reason?: string;
}

export async function changeDeadline(
  taskId: string,
  input: ChangeDeadlineInput,
  changedById: string,
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
    throw new ServiceError('Cannot change deadline of a closed task', 409);
  }

  if (scope !== 'any') {
    const existingBatchIds = existing.taskBatches.map((tb) => tb.batchId);
    const trainerBatch = await prisma.batchTrainer.findFirst({
      where: { trainerId: changedById, batchId: { in: existingBatchIds } },
    });
    if (!trainerBatch) {
      throw new ServiceError('You are not a trainer for any of this task\'s batches', 403);
    }
  }

  const newDeadline = input.deadline ? new Date(input.deadline) : null;

  const result = await prisma.$transaction(async (tx) => {
    await tx.taskDeadlineChange.create({
      data: {
        taskId,
        oldDeadlineType: existing.deadlineType,
        newDeadlineType: input.deadlineType,
        oldDeadline: existing.deadline,
        newDeadline: newDeadline,
        reason: input.reason || null,
        changedById,
      },
    });

    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        deadlineType: input.deadlineType,
        deadline: newDeadline,
        deadlineNote: input.deadlineNote !== undefined ? input.deadlineNote : existing.deadlineNote,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: {
          include: { batch: { select: { id: true, name: true } } },
        },
      },
    });

    if (newDeadline && input.deadlineType === 'FIXED') {
      const completedSubs = await tx.taskSubmission.findMany({
        where: { taskId, progress: 'COMPLETED', completedAt: { not: null } },
        select: { id: true, completedAt: true },
      });

      for (const sub of completedSubs) {
        await tx.taskSubmission.update({
          where: { id: sub.id },
          data: { isLate: sub.completedAt! > newDeadline },
        });
      }
    } else if (input.deadlineType !== 'FIXED') {
      await tx.taskSubmission.updateMany({
        where: { taskId, isLate: { not: null } },
        data: { isLate: null },
      });
    }

    await notifyStudents(
      tx,
      taskId,
      task.title,
      input.deadlineType === 'NONE'
        ? 'Deadline has been removed'
        : `Deadline changed to ${input.deadlineType}${newDeadline ? ': ' + newDeadline.toISOString() : ''}`,
    );

    return task;
  });

  return result;
}

async function checkTaskTrainerAuth(
  userId: string,
  scope: string,
  existing: { taskBatches: { batchId: string }[] },
) {
  if (scope !== 'any') {
    const batchIds = existing.taskBatches.map((tb) => tb.batchId);
    const trainerBatch = await prisma.batchTrainer.findFirst({
      where: { trainerId: userId, batchId: { in: batchIds } },
    });
    if (!trainerBatch) {
      throw new ServiceError('You are not a trainer for any of this task\'s batches', 403);
    }
  }
}

export async function closeTask(taskId: string, userId: string, scope: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!existing) throw new ServiceError('Task not found', 404);
  if (existing.closedAt) throw new ServiceError('Task is already closed', 409);
  await checkTaskTrainerAuth(userId, scope, existing);

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { closedAt: new Date() },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: { include: { batch: { select: { id: true, name: true } } } },
      },
    });

    await notifyStudents(tx, taskId, updated.title, 'This task has been closed');
    return updated;
  });

  return task;
}

export async function reopenTask(taskId: string, userId: string, scope: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!existing) throw new ServiceError('Task not found', 404);
  if (!existing.closedAt) throw new ServiceError('Task is not closed', 409);
  await checkTaskTrainerAuth(userId, scope, existing);

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: taskId },
      data: { closedAt: null },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        taskBatches: { include: { batch: { select: { id: true, name: true } } } },
      },
    });

    await notifyStudents(tx, taskId, updated.title, 'This task has been reopened');
    return updated;
  });

  return task;
}

export async function deleteTask(taskId: string, userId: string, scope: string) {
  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!existing) throw new ServiceError('Task not found', 404);
  await checkTaskTrainerAuth(userId, scope, existing);

  const hasProgress = await prisma.taskSubmission.findFirst({
    where: { taskId, progress: { not: 'NOT_STARTED' } },
  });

  if (hasProgress) {
    throw new ServiceError(
      'Cannot delete task: students have started working on it. Close it instead.',
      409,
    );
  }

  await prisma.task.delete({ where: { id: taskId } });
}

interface StudentTaskFilters {
  batchId?: string;
  progress?: TaskProgress;
  isMandatory?: boolean;
  status?: 'open' | 'closed';
}

export async function getStudentTasks(studentId: string, filters: StudentTaskFilters) {
  const memberships = await prisma.batchMember.findMany({
    where: { studentId },
    select: { batchId: true },
  });
  const studentBatchIds = memberships.map((m) => m.batchId);

  if (studentBatchIds.length === 0) {
    return [];
  }

  const batchFilter = filters.batchId && studentBatchIds.includes(filters.batchId)
    ? [filters.batchId]
    : studentBatchIds;

  const taskWhere: Prisma.TaskWhereInput = {
    taskBatches: { some: { batchId: { in: batchFilter } } },
  };

  if (filters.isMandatory !== undefined) taskWhere.isMandatory = filters.isMandatory;
  if (filters.status === 'open') taskWhere.closedAt = null;
  else if (filters.status === 'closed') taskWhere.closedAt = { not: null };
  else taskWhere.closedAt = null;

  const tasks = await prisma.task.findMany({
    where: taskWhere,
    include: {
      taskBatches: {
        where: { batchId: { in: batchFilter } },
        include: { batch: { select: { id: true, name: true } } },
      },
      submissions: {
        where: { studentId },
        select: {
          id: true,
          progress: true,
          isInterested: true,
          completedAt: true,
          isLate: true,
          marksAwarded: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const result = tasks.map((task) => {
    const submission = task.submissions[0] || null;
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      isMandatory: task.isMandatory,
      isInternal: task.isInternal,
      maxMarks: task.isInternal ? task.maxMarks : undefined,
      deadlineType: task.deadlineType,
      deadline: task.deadline,
      deadlineNote: task.deadlineNote,
      batches: task.taskBatches.map((tb) => ({ id: tb.batchId, name: tb.batch.name })),
      submission,
      createdAt: task.createdAt,
    };
  });

  if (filters.progress) {
    return result.filter((t) => {
      if (!t.submission) return filters.progress === 'NOT_STARTED';
      return t.submission.progress === filters.progress;
    });
  }

  return result;
}

export async function updateStudentProgress(
  taskId: string,
  studentId: string,
  progress: TaskProgress,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, closedAt: true, deadlineType: true, deadline: true, isMandatory: true },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (task.closedAt) throw new ServiceError('Cannot update progress on a closed task', 409);

  let submission = await prisma.taskSubmission.findUnique({
    where: { taskId_studentId: { taskId, studentId } },
  });

  if (!submission && task.isMandatory) {
    throw new ServiceError('Submission record missing for mandatory task', 500);
  }

  if (!submission) {
    submission = await prisma.taskSubmission.create({
      data: { taskId, studentId, progress },
    });
  }

  const now = new Date();
  let completedAt = submission.completedAt;
  let isLate = submission.isLate;

  if (progress === 'COMPLETED' && submission.progress !== 'COMPLETED') {
    completedAt = now;
    isLate = task.deadlineType === 'FIXED' && task.deadline ? now > task.deadline : null;
  } else if (progress !== 'COMPLETED' && submission.progress === 'COMPLETED') {
    completedAt = null;
    isLate = null;
  }

  const updated = await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: { progress, completedAt, isLate },
    include: {
      task: { select: { id: true, title: true, deadlineType: true, deadline: true } },
    },
  });

  return updated;
}

export async function toggleInterested(taskId: string, studentId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, closedAt: true, isMandatory: true },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (task.closedAt) throw new ServiceError('Cannot express interest in a closed task', 409);
  if (task.isMandatory) throw new ServiceError('Cannot toggle interest on a mandatory task', 400);

  let submission = await prisma.taskSubmission.findUnique({
    where: { taskId_studentId: { taskId, studentId } },
  });

  if (!submission) {
    submission = await prisma.taskSubmission.create({
      data: { taskId, studentId, isInterested: true },
    });
    return submission;
  }

  const updated = await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: { isInterested: !submission.isInterested },
  });

  return updated;
}

export async function addStudentToTask(
  taskId: string,
  studentId: string,
  addedById: string,
  scope: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (task.closedAt) throw new ServiceError('Cannot add student to a closed task', 409);

  await checkTaskTrainerAuth(addedById, scope, task);

  const taskBatchIds = task.taskBatches.map((tb) => tb.batchId);
  const membership = await prisma.batchMember.findFirst({
    where: { studentId, batchId: { in: taskBatchIds } },
  });
  if (!membership) {
    throw new ServiceError('Student is not a member of any batch this task targets', 400);
  }

  const existing = await prisma.taskSubmission.findUnique({
    where: { taskId_studentId: { taskId, studentId } },
  });
  if (existing) {
    throw new ServiceError('Student already has a submission for this task', 409);
  }

  const submission = await prisma.taskSubmission.create({
    data: { taskId, studentId },
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
  });

  return submission;
}

interface SetMarksInput {
  studentId: string;
  marksAwarded: number | null;
}

export async function setMarks(
  taskId: string,
  input: SetMarksInput,
  gradedById: string,
  scope: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (!task.isInternal) throw new ServiceError('Cannot set marks on a non-internal task', 400);

  await checkTaskTrainerAuth(gradedById, scope, task);

  if (input.marksAwarded !== null) {
    if (input.marksAwarded < 0) {
      throw new ServiceError('marksAwarded cannot be negative', 400);
    }
    if (task.maxMarks !== null && input.marksAwarded > task.maxMarks) {
      throw new ServiceError(`marksAwarded cannot exceed maxMarks (${task.maxMarks})`, 400);
    }
  }

  const submission = await prisma.taskSubmission.findUnique({
    where: { taskId_studentId: { taskId, studentId: input.studentId } },
  });
  if (!submission) {
    throw new ServiceError('Student does not have a submission for this task', 404);
  }

  const updated = await prisma.taskSubmission.update({
    where: { id: submission.id },
    data: {
      marksAwarded: input.marksAwarded,
      gradedById: input.marksAwarded !== null ? gradedById : null,
    },
    include: {
      student: { select: { id: true, name: true, email: true } },
      gradedBy: { select: { id: true, name: true } },
    },
  });

  return updated;
}

export async function bulkSetMarks(
  taskId: string,
  entries: SetMarksInput[],
  gradedById: string,
  scope: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (!task.isInternal) throw new ServiceError('Cannot set marks on a non-internal task', 400);

  await checkTaskTrainerAuth(gradedById, scope, task);

  const results: { studentId: string; status: 'updated' | 'error'; error?: string }[] = [];

  for (const entry of entries) {
    try {
      if (entry.marksAwarded !== null) {
        if (entry.marksAwarded < 0) throw new Error('marksAwarded cannot be negative');
        if (task.maxMarks !== null && entry.marksAwarded > task.maxMarks) {
          throw new Error(`marksAwarded cannot exceed maxMarks (${task.maxMarks})`);
        }
      }

      const submission = await prisma.taskSubmission.findUnique({
        where: { taskId_studentId: { taskId, studentId: entry.studentId } },
      });
      if (!submission) throw new Error('No submission found');

      await prisma.taskSubmission.update({
        where: { id: submission.id },
        data: {
          marksAwarded: entry.marksAwarded,
          gradedById: entry.marksAwarded !== null ? gradedById : null,
        },
      });

      results.push({ studentId: entry.studentId, status: 'updated' });
    } catch (err: any) {
      results.push({ studentId: entry.studentId, status: 'error', error: err.message });
    }
  }

  return {
    total: entries.length,
    updated: results.filter((r) => r.status === 'updated').length,
    errors: results.filter((r) => r.status === 'error').length,
    details: results,
  };
}

export async function exportMarks(taskId: string, userId: string, scope: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { taskBatches: { select: { batchId: true } } },
  });

  if (!task) throw new ServiceError('Task not found', 404);
  if (!task.isInternal) throw new ServiceError('Cannot export marks for a non-internal task', 400);

  await checkTaskTrainerAuth(userId, scope, task);

  const submissions = await prisma.taskSubmission.findMany({
    where: { taskId },
    include: {
      student: { select: { id: true, name: true, email: true } },
      gradedBy: { select: { id: true, name: true } },
    },
    orderBy: { student: { name: 'asc' } },
  });

  return {
    task: {
      id: task.id,
      title: task.title,
      maxMarks: task.maxMarks,
      isInternal: task.isInternal,
    },
    submissions: submissions.map((s) => ({
      studentId: s.studentId,
      studentName: s.student.name,
      studentEmail: s.student.email,
      progress: s.progress,
      marksAwarded: s.marksAwarded,
      gradedBy: s.gradedBy ? s.gradedBy.name : null,
      completedAt: s.completedAt,
      isLate: s.isLate,
    })),
  };
}
