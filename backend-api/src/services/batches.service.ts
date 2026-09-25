import prisma from "../lib/prisma";

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export { ServiceError };

// --- Batch CRUD ---

interface CreateBatchInput {
  name: string;
  department?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export async function createBatch(input: CreateBatchInput) {
  return prisma.batch.create({
    data: {
      name: input.name,
      department: input.department,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      description: input.description,
    },
  });
}

export async function listBatches() {
  const batches = await prisma.batch.findMany({
    include: {
      _count: {
        select: {
          members: true,
          trainers: true,
          sessions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((b) => ({
    id: b.id,
    name: b.name,
    department: b.department,
    startDate: b.startDate,
    endDate: b.endDate,
    description: b.description,
    createdAt: b.createdAt,
    memberCount: b._count.members,
    trainerCount: b._count.trainers,
    sessionCount: b._count.sessions,
  }));
}

export async function getBatchById(id: string) {
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      trainers: {
        include: {
          trainer: { select: { id: true, name: true, email: true } },
        },
      },
      _count: {
        select: {
          members: true,
          sessions: true,
        },
      },
    },
  });

  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  return {
    id: batch.id,
    name: batch.name,
    department: batch.department,
    startDate: batch.startDate,
    endDate: batch.endDate,
    description: batch.description,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
    trainers: batch.trainers.map((bt) => ({
      id: bt.trainer.id,
      name: bt.trainer.name,
      email: bt.trainer.email,
      assignedAt: bt.assignedAt,
    })),
    memberCount: batch._count.members,
    sessionCount: batch._count.sessions,
  };
}

export async function updateBatch(
  id: string,
  data: {
    name?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }
) {
  const existing = await prisma.batch.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Batch not found", 404);
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.batch.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteBatch(id: string) {
  const existing = await prisma.batch.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Batch not found", 404);
  }

  const sessionCount = await prisma.session.count({ where: { batchId: id } });
  if (sessionCount > 0) {
    throw new ServiceError(
      "Cannot delete batch: it has associated sessions. Remove all sessions first.",
      409
    );
  }

  const assessmentCount = await prisma.assessment.count({ where: { batchId: id } });
  if (assessmentCount > 0) {
    throw new ServiceError(
      "Cannot delete batch: it has associated assessments. Remove all assessments first.",
      409
    );
  }

  await prisma.batch.delete({ where: { id } });
}

// --- Roster (Students) ---

export async function getRoster(batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  const members = await prisma.batchMember.findMany({
    where: { batchId },
    include: {
      student: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.student.id,
    name: m.student.name,
    email: m.student.email,
    department: m.student.department,
    joinedAt: m.joinedAt,
  }));
}

export async function addStudent(batchId: string, studentId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) {
    throw new ServiceError("Student not found", 404);
  }

  const existing = await prisma.batchMember.findUnique({
    where: { batchId_studentId: { batchId, studentId } },
  });
  if (existing) {
    throw new ServiceError("Student is already a member of this batch", 409);
  }

  const member = await prisma.batchMember.create({
    data: { batchId, studentId },
    include: {
      student: { select: { id: true, name: true, email: true, department: true } },
    },
  });

  return {
    id: member.student.id,
    name: member.student.name,
    email: member.student.email,
    department: member.student.department,
    joinedAt: member.joinedAt,
  };
}

export async function removeStudent(batchId: string, studentId: string) {
  const existing = await prisma.batchMember.findUnique({
    where: { batchId_studentId: { batchId, studentId } },
  });
  if (!existing) {
    throw new ServiceError("Student is not a member of this batch", 404);
  }

  await prisma.batchMember.delete({
    where: { batchId_studentId: { batchId, studentId } },
  });
}

// --- Trainers ---

export async function getTrainers(batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  const trainers = await prisma.batchTrainer.findMany({
    where: { batchId },
    include: {
      trainer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assignedAt: "asc" },
  });

  return trainers.map((t) => ({
    id: t.trainer.id,
    name: t.trainer.name,
    email: t.trainer.email,
    assignedAt: t.assignedAt,
  }));
}

export async function assignTrainer(batchId: string, trainerId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  const trainer = await prisma.user.findUnique({ where: { id: trainerId } });
  if (!trainer) {
    throw new ServiceError("Trainer not found", 404);
  }

  const existing = await prisma.batchTrainer.findUnique({
    where: { batchId_trainerId: { batchId, trainerId } },
  });
  if (existing) {
    throw new ServiceError("Trainer is already assigned to this batch", 409);
  }

  const assignment = await prisma.batchTrainer.create({
    data: { batchId, trainerId },
    include: {
      trainer: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    id: assignment.trainer.id,
    name: assignment.trainer.name,
    email: assignment.trainer.email,
    assignedAt: assignment.assignedAt,
  };
}

export async function removeTrainer(batchId: string, trainerId: string) {
  const existing = await prisma.batchTrainer.findUnique({
    where: { batchId_trainerId: { batchId, trainerId } },
  });
  if (!existing) {
    throw new ServiceError("Trainer is not assigned to this batch", 404);
  }

  await prisma.batchTrainer.delete({
    where: { batchId_trainerId: { batchId, trainerId } },
  });
}

// --- Sessions ---

export async function listSessions(batchId: string) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  return prisma.session.findMany({
    where: { batchId },
    include: {
      trainer: { select: { id: true, name: true, email: true } },
    },
    orderBy: { scheduledDate: "desc" },
  });
}

interface CreateSessionInput {
  trainerId: string;
  title: string;
  topic?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

export async function createSession(batchId: string, input: CreateSessionInput) {
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError("Batch not found", 404);
  }

  const trainer = await prisma.user.findUnique({ where: { id: input.trainerId } });
  if (!trainer) {
    throw new ServiceError("Trainer not found", 404);
  }

  return prisma.session.create({
    data: {
      batchId,
      trainerId: input.trainerId,
      title: input.title,
      topic: input.topic,
      scheduledDate: new Date(input.scheduledDate),
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
    },
    include: {
      batch: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function getSessionById(id: string) {
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      batch: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!session) {
    throw new ServiceError("Session not found", 404);
  }

  return session;
}

export async function updateSession(
  id: string,
  data: {
    trainerId?: string;
    title?: string;
    topic?: string;
    scheduledDate?: string;
    startTime?: string;
    endTime?: string;
  }
) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Session not found", 404);
  }

  if (data.trainerId) {
    const trainer = await prisma.user.findUnique({ where: { id: data.trainerId } });
    if (!trainer) {
      throw new ServiceError("Trainer not found", 404);
    }
  }

  const finalStartTime = data.startTime
    ? new Date(data.startTime)
    : existing.startTime;
  const finalEndTime = data.endTime
    ? new Date(data.endTime)
    : existing.endTime;

  if (finalEndTime <= finalStartTime) {
    throw new ServiceError("endTime must be after startTime", 400);
  }

  const updateData: Record<string, unknown> = {};
  if (data.trainerId !== undefined) updateData.trainerId = data.trainerId;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.topic !== undefined) updateData.topic = data.topic;
  if (data.scheduledDate !== undefined) updateData.scheduledDate = new Date(data.scheduledDate);
  if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
  if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);

  return prisma.session.update({
    where: { id },
    data: updateData,
    include: {
      batch: { select: { id: true, name: true } },
      trainer: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function deleteSession(id: string) {
  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Session not found", 404);
  }

  const attendanceCount = await prisma.attendance.count({ where: { sessionId: id } });
  if (attendanceCount > 0) {
    throw new ServiceError(
      "Cannot delete session: it has associated attendance records.",
      409
    );
  }

  const feedbackCount = await prisma.feedback.count({ where: { sessionId: id } });
  if (feedbackCount > 0) {
    throw new ServiceError(
      "Cannot delete session: it has associated feedback records.",
      409
    );
  }

  await prisma.session.delete({ where: { id } });
}
