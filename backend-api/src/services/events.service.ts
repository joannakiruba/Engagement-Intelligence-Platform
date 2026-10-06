import prisma from '../lib/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';

export class ServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// ── Helpers ──

async function notifyRegisteredStudents(
  tx: TxClient,
  eventId: string,
  title: string,
  message: string,
) {
  const registrations = await tx.eventRegistration.findMany({
    where: { eventId, status: { not: 'WITHDRAWN' } },
    select: { studentId: true },
  });

  if (registrations.length === 0) return;

  await tx.notification.createMany({
    data: registrations.map((r) => ({
      userId: r.studentId,
      title,
      message,
      type: 'EVENT_UPDATE' as const,
    })),
  });
}

async function checkEventTrainerAuth(
  userId: string,
  eventBatchIds: string[],
): Promise<boolean> {
  if (eventBatchIds.length > 0) {
    const trainerBatch = await prisma.batchTrainer.findFirst({
      where: { trainerId: userId, batchId: { in: eventBatchIds } },
    });
    return trainerBatch !== null;
  }
  const anyBatch = await prisma.batchTrainer.findFirst({
    where: { trainerId: userId },
  });
  return anyBatch !== null;
}

const eventIncludes = {
  createdBy: { select: { id: true, name: true, email: true } },
  eventBatches: { include: { batch: { select: { id: true, name: true } } } },
  rounds: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { registrations: true } },
};

// ── Create ──

export interface CreateEventData {
  title: string;
  description?: string | null;
  category?: string;
  isMandatory?: boolean;
  batchIds?: string[];
  mode?: string | null;
  officialLink?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  venue?: string | null;
  fee?: number | null;
}

export async function createEvent(
  data: CreateEventData,
  userId: string,
  scope: string,
) {
  const { batchIds = [], ...eventFields } = data;

  if (batchIds.length > 0) {
    const batches = await prisma.batch.findMany({
      where: { id: { in: batchIds } },
      select: { id: true },
    });
    if (batches.length !== batchIds.length) {
      throw new ServiceError('One or more batch IDs are invalid.', 400);
    }

    if (scope === 'batch') {
      const trainerBatches = await prisma.batchTrainer.findMany({
        where: { trainerId: userId, batchId: { in: batchIds } },
        select: { batchId: true },
      });
      const ownedIds = new Set(trainerBatches.map((b) => b.batchId));
      if (!batchIds.every((id) => ownedIds.has(id))) {
        throw new ServiceError('You can only create events for your own batches.', 403);
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        title: eventFields.title,
        description: eventFields.description || undefined,
        category: (eventFields.category as any) || 'OTHER',
        isMandatory: eventFields.isMandatory ?? false,
        officialLink: eventFields.officialLink || undefined,
        startDate: eventFields.startDate ? new Date(eventFields.startDate as string) : undefined,
        endDate: eventFields.endDate ? new Date(eventFields.endDate as string) : undefined,
        mode: (eventFields.mode as any) || undefined,
        venue: eventFields.venue || undefined,
        fee: eventFields.fee ?? undefined,
        createdById: userId,
      },
    });

    if (batchIds.length > 0) {
      await tx.eventBatch.createMany({
        data: batchIds.map((batchId) => ({ eventId: event.id, batchId })),
      });
    }

    if (eventFields.isMandatory) {
      let studentIds: string[];
      if (batchIds.length > 0) {
        const members = await tx.batchMember.findMany({
          where: { batchId: { in: batchIds } },
          select: { studentId: true },
        });
        studentIds = [...new Set(members.map((m) => m.studentId))];
      } else {
        const students = await tx.user.findMany({
          where: { role: { name: 'STUDENT' }, status: 'ACTIVE' },
          select: { id: true },
        });
        studentIds = students.map((s) => s.id);
      }

      if (studentIds.length > 0) {
        await tx.eventRegistration.createMany({
          data: studentIds.map((studentId) => ({
            eventId: event.id,
            studentId,
            status: 'PENDING' as const,
          })),
        });
      }
    }

    return tx.event.findUniqueOrThrow({
      where: { id: event.id },
      include: eventIncludes,
    });
  });
}

// ── Update ──

export interface UpdateEventData {
  title?: string;
  description?: string | null;
  category?: string;
  isMandatory?: boolean;
  addBatchIds?: string[];
  mode?: string | null;
  officialLink?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  venue?: string | null;
  fee?: number | null;
}

export async function updateEvent(
  id: string,
  data: UpdateEventData,
  userId: string,
  scope: string,
) {
  const existing = await prisma.event.findUnique({
    where: { id },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!existing) throw new ServiceError('Event not found.', 404);
  if (existing.closedAt) throw new ServiceError('Cannot update a closed event.', 409);

  if (scope === 'batch') {
    const batchIds = existing.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (existing.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  const { addBatchIds, ...updateFields } = data;

  return prisma.$transaction(async (tx) => {
    if (addBatchIds && addBatchIds.length > 0) {
      const existingBatchIds = new Set(existing.eventBatches.map((eb) => eb.batchId));
      const newBatchIds = addBatchIds.filter((bid) => !existingBatchIds.has(bid));

      if (newBatchIds.length > 0) {
        const batches = await tx.batch.findMany({
          where: { id: { in: newBatchIds } },
          select: { id: true },
        });
        if (batches.length !== newBatchIds.length) {
          throw new ServiceError('One or more batch IDs are invalid.', 400);
        }

        if (scope === 'batch') {
          const trainerBatches = await tx.batchTrainer.findMany({
            where: { trainerId: userId, batchId: { in: newBatchIds } },
            select: { batchId: true },
          });
          if (trainerBatches.length !== newBatchIds.length) {
            throw new ServiceError('You can only add your own batches.', 403);
          }
        }

        await tx.eventBatch.createMany({
          data: newBatchIds.map((batchId) => ({ eventId: id, batchId })),
        });

        if (existing.isMandatory || updateFields.isMandatory) {
          const newMembers = await tx.batchMember.findMany({
            where: { batchId: { in: newBatchIds } },
            select: { studentId: true },
          });
          const existingRegs = await tx.eventRegistration.findMany({
            where: { eventId: id },
            select: { studentId: true },
          });
          const existingStudentIds = new Set(existingRegs.map((r) => r.studentId));
          const toCreate = [...new Set(newMembers.map((m) => m.studentId))]
            .filter((sid) => !existingStudentIds.has(sid));

          if (toCreate.length > 0) {
            await tx.eventRegistration.createMany({
              data: toCreate.map((studentId) => ({
                eventId: id,
                studentId,
                status: 'PENDING' as const,
              })),
            });
          }
        }
      }
    }

    const wasMandatory = existing.isMandatory;
    const becomingMandatory = updateFields.isMandatory === true && !wasMandatory;

    if (becomingMandatory) {
      const allBatchIds = [
        ...existing.eventBatches.map((eb) => eb.batchId),
        ...(addBatchIds || []),
      ];
      const uniqueBatchIds = [...new Set(allBatchIds)];

      let studentIds: string[];
      if (uniqueBatchIds.length > 0) {
        const members = await tx.batchMember.findMany({
          where: { batchId: { in: uniqueBatchIds } },
          select: { studentId: true },
        });
        studentIds = [...new Set(members.map((m) => m.studentId))];
      } else {
        const students = await tx.user.findMany({
          where: { role: { name: 'STUDENT' }, status: 'ACTIVE' },
          select: { id: true },
        });
        studentIds = students.map((s) => s.id);
      }

      const existingRegs = await tx.eventRegistration.findMany({
        where: { eventId: id },
        select: { studentId: true },
      });
      const existingStudentIds = new Set(existingRegs.map((r) => r.studentId));
      const toCreate = studentIds.filter((sid) => !existingStudentIds.has(sid));

      if (toCreate.length > 0) {
        await tx.eventRegistration.createMany({
          data: toCreate.map((studentId) => ({
            eventId: id,
            studentId,
            status: 'PENDING' as const,
          })),
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updateFields.title !== undefined) updateData.title = updateFields.title;
    if (updateFields.description !== undefined) updateData.description = updateFields.description;
    if (updateFields.category !== undefined) updateData.category = updateFields.category;
    if (updateFields.isMandatory !== undefined) updateData.isMandatory = updateFields.isMandatory;
    if (updateFields.officialLink !== undefined) updateData.officialLink = updateFields.officialLink;
    if (updateFields.venue !== undefined) updateData.venue = updateFields.venue;
    if (updateFields.fee !== undefined) updateData.fee = updateFields.fee;
    if (updateFields.mode !== undefined) updateData.mode = updateFields.mode;
    if (updateFields.startDate !== undefined) {
      updateData.startDate = updateFields.startDate ? new Date(updateFields.startDate as string) : null;
    }
    if (updateFields.endDate !== undefined) {
      updateData.endDate = updateFields.endDate ? new Date(updateFields.endDate as string) : null;
    }

    if (Object.keys(updateData).length > 0 || (addBatchIds && addBatchIds.length > 0)) {
      if (Object.keys(updateData).length > 0) {
        await tx.event.update({ where: { id }, data: updateData });
      }

      const changedFields = Object.keys(updateData)
        .filter((k) => k !== 'isMandatory')
        .map((k) => `${k}: ${JSON.stringify(updateData[k])}`);
      if (addBatchIds && addBatchIds.length > 0) changedFields.push('new batches added');
      if (becomingMandatory) changedFields.push('event is now mandatory');

      if (changedFields.length > 0) {
        await notifyRegisteredStudents(
          tx,
          id,
          `Event Updated: ${existing.title}`,
          `Updated fields: ${changedFields.join(', ')}`,
        );
      }
    }

    return tx.event.findUniqueOrThrow({
      where: { id },
      include: eventIncludes,
    });
  });
}

// ── Close / Reopen ──

export async function closeEvent(id: string, userId: string, scope: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (event.closedAt) throw new ServiceError('Event is already closed.', 409);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (event.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id },
      data: { closedAt: new Date() },
      include: eventIncludes,
    });

    await notifyRegisteredStudents(tx, id, `Event Closed: ${event.title}`, 'This event has been closed.');

    return updated;
  });
}

export async function reopenEvent(id: string, userId: string, scope: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (!event.closedAt) throw new ServiceError('Event is not closed.', 409);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (event.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id },
      data: { closedAt: null },
      include: eventIncludes,
    });

    await notifyRegisteredStudents(tx, id, `Event Reopened: ${event.title}`, 'This event has been reopened.');

    return updated;
  });
}

// ── Delete ──

export async function deleteEvent(id: string, userId: string, scope: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      eventBatches: { select: { batchId: true } },
      registrations: { select: { status: true } },
    },
  });
  if (!event) throw new ServiceError('Event not found.', 404);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  }

  const hasBeyondPending = event.registrations.some((r) => r.status !== 'PENDING');
  if (hasBeyondPending) {
    throw new ServiceError(
      'Cannot delete event with active registrations. Close the event instead.',
      409,
    );
  }

  await prisma.event.delete({ where: { id } });
  return { message: 'Event deleted.' };
}

// ── Rounds ──

export async function addRound(
  eventId: string,
  data: { name: string; roundDate?: Date | string | null; deadline?: Date | string | null; status?: string },
  userId: string,
  scope: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (event.closedAt) throw new ServiceError('Cannot modify rounds on a closed event.', 409);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (event.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  return prisma.$transaction(async (tx) => {
    const round = await tx.eventRound.create({
      data: {
        eventId,
        name: data.name,
        roundDate: data.roundDate ? new Date(data.roundDate as string) : undefined,
        deadline: data.deadline ? new Date(data.deadline as string) : undefined,
        status: (data.status as any) || 'UPCOMING',
      },
    });

    await notifyRegisteredStudents(
      tx,
      eventId,
      `New Round: ${event.title}`,
      `Round "${data.name}" has been added.`,
    );

    return round;
  });
}

export async function updateRound(
  eventId: string,
  roundId: string,
  data: { name?: string; roundDate?: Date | string | null; deadline?: Date | string | null; status?: string },
  userId: string,
  scope: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (event.closedAt) throw new ServiceError('Cannot modify rounds on a closed event.', 409);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (event.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  const round = await prisma.eventRound.findFirst({
    where: { id: roundId, eventId },
  });
  if (!round) throw new ServiceError('Round not found.', 404);

  return prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.roundDate !== undefined) {
      updateData.roundDate = data.roundDate ? new Date(data.roundDate as string) : null;
    }
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline as string) : null;
    }

    const updated = await tx.eventRound.update({
      where: { id: roundId },
      data: updateData,
    });

    await notifyRegisteredStudents(
      tx,
      eventId,
      `Round Updated: ${event.title}`,
      `Round "${updated.name}" has been updated.`,
    );

    return updated;
  });
}

export async function deleteRound(
  eventId: string,
  roundId: string,
  userId: string,
  scope: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (event.closedAt) throw new ServiceError('Cannot modify rounds on a closed event.', 409);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    if (event.createdById !== userId) throw new ServiceError('Event not found.', 404);
  }

  const round = await prisma.eventRound.findFirst({
    where: { id: roundId, eventId },
  });
  if (!round) throw new ServiceError('Round not found.', 404);

  await prisma.eventRound.delete({ where: { id: roundId } });
  return { message: 'Round deleted.' };
}

// ── List Events (Trainer/Admin) ──

export interface ListEventsFilters {
  batchId?: string;
  category?: string;
  isMandatory?: string;
  status?: string;
  search?: string;
}

export async function listEvents(
  filters: ListEventsFilters,
  userId: string,
  scope: string,
  page: number,
  limit: number,
) {
  const where: Prisma.EventWhereInput = {};

  if (filters.batchId) {
    where.eventBatches = { some: { batchId: filters.batchId } };
  }
  if (filters.category) {
    where.category = filters.category as any;
  }
  if (filters.isMandatory !== undefined) {
    where.isMandatory = filters.isMandatory === 'true';
  }
  if (filters.status === 'open') {
    where.closedAt = null;
  } else if (filters.status === 'closed') {
    where.closedAt = { not: null };
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: 'insensitive' };
  }

  if (scope === 'batch') {
    const trainerBatches = await prisma.batchTrainer.findMany({
      where: { trainerId: userId },
      select: { batchId: true },
    });
    const batchIds = trainerBatches.map((b) => b.batchId);
    where.OR = [
      { eventBatches: { some: { batchId: { in: batchIds } } } },
      { eventBatches: { none: {} } },
    ];
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      include: {
        ...eventIncludes,
        registrations: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  const eventsWithCounts = events.map((event) => {
    const statusCounts: Record<string, number> = { PENDING: 0, INTERESTED: 0, REGISTERED: 0, WITHDRAWN: 0 };
    for (const reg of event.registrations) {
      statusCounts[reg.status] = (statusCounts[reg.status] || 0) + 1;
    }
    const { registrations: _regs, ...rest } = event;
    return { ...rest, statusCounts };
  });

  return { events: eventsWithCounts, total };
}

// ── Get Event By ID ──

export async function getEventById(
  id: string,
  userId: string,
  scope: string,
  statusFilter?: string,
) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      ...eventIncludes,
      registrations: {
        where: statusFilter ? { status: statusFilter as any } : undefined,
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  if (!event) throw new ServiceError('Event not found.', 404);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batch.id);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  } else if (scope === 'own') {
    const memberBatches = await prisma.batchMember.findMany({
      where: { studentId: userId },
      select: { batchId: true },
    });
    const studentBatchIds = new Set(memberBatches.map((m) => m.batchId));
    const eventBatchIds = event.eventBatches.map((eb) => eb.batch.id);
    const isOpenToAll = eventBatchIds.length === 0;
    const isInBatch = eventBatchIds.some((bid) => studentBatchIds.has(bid));
    if (!isOpenToAll && !isInBatch) throw new ServiceError('Event not found.', 404);
  }

  const allRegs = await prisma.eventRegistration.findMany({
    where: { eventId: id },
    select: { status: true },
  });
  const statusCounts: Record<string, number> = { PENDING: 0, INTERESTED: 0, REGISTERED: 0, WITHDRAWN: 0 };
  for (const reg of allRegs) {
    statusCounts[reg.status] = (statusCounts[reg.status] || 0) + 1;
  }

  return { ...event, statusCounts };
}

// ── Student Events ──

export interface StudentEventsFilters {
  category?: string;
  status?: string;
}

export async function getStudentEvents(userId: string, filters: StudentEventsFilters) {
  const memberships = await prisma.batchMember.findMany({
    where: { studentId: userId },
    select: { batchId: true },
  });
  const studentBatchIds = memberships.map((m) => m.batchId);

  const where: Prisma.EventWhereInput = {
    OR: [
      { eventBatches: { some: { batchId: { in: studentBatchIds } } } },
      { eventBatches: { none: {} } },
    ],
  };

  if (filters.category) {
    where.category = filters.category as any;
  }

  if (!filters.status || filters.status === 'open') {
    where.closedAt = null;
  } else if (filters.status === 'closed') {
    where.closedAt = { not: null };
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      ...eventIncludes,
      registrations: {
        where: { studentId: userId },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return events.map((event) => {
    const myRegistration = event.registrations[0] || null;
    const { registrations: _regs, ...rest } = event;
    return { ...rest, myRegistration };
  });
}

// ── Set Student Registration Status ──

export async function setStudentRegistrationStatus(
  eventId: string,
  studentId: string,
  status: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);
  if (event.closedAt) throw new ServiceError('Cannot change status on a closed event.', 409);

  const eventBatchIds = event.eventBatches.map((eb) => eb.batchId);
  if (eventBatchIds.length > 0) {
    const membership = await prisma.batchMember.findFirst({
      where: { studentId, batchId: { in: eventBatchIds } },
    });
    if (!membership) throw new ServiceError('You are not in a batch targeted by this event.', 403);
  }

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_studentId: { eventId, studentId } },
  });

  if (!existing) {
    if (event.isMandatory) {
      throw new ServiceError('Registration row missing for mandatory event.', 404);
    }
    if (status !== 'INTERESTED') {
      throw new ServiceError('You must mark as INTERESTED before registering.', 400);
    }
    return prisma.eventRegistration.create({
      data: { eventId, studentId, status: 'INTERESTED' as any },
    });
  }

  return prisma.eventRegistration.update({
    where: { id: existing.id },
    data: { status: status as any },
  });
}

// ── Get Event Registrations (Trainer/Admin) ──

export async function getEventRegistrations(
  eventId: string,
  userId: string,
  scope: string,
  statusFilter?: string,
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { eventBatches: { select: { batchId: true } } },
  });
  if (!event) throw new ServiceError('Event not found.', 404);

  if (scope === 'batch') {
    const batchIds = event.eventBatches.map((eb) => eb.batchId);
    const authorized = await checkEventTrainerAuth(userId, batchIds);
    if (!authorized) throw new ServiceError('Event not found.', 404);
  }

  const regWhere: Prisma.EventRegistrationWhereInput = { eventId };
  if (statusFilter) {
    regWhere.status = statusFilter as any;
  }

  const registrations = await prisma.eventRegistration.findMany({
    where: regWhere,
    include: {
      student: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const allRegs = await prisma.eventRegistration.findMany({
    where: { eventId },
    select: { status: true },
  });
  const statusCounts: Record<string, number> = { PENDING: 0, INTERESTED: 0, REGISTERED: 0, WITHDRAWN: 0 };
  for (const reg of allRegs) {
    statusCounts[reg.status] = (statusCounts[reg.status] || 0) + 1;
  }

  return { registrations, statusCounts };
}
