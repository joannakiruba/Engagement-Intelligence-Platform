import prisma from '../lib/prisma';

export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export async function listEvents() {
  const events = await prisma.event.findMany({
    include: {
      _count: { select: { registrations: true, proofSubmissions: true } },
    },
    orderBy: { eventDate: 'desc' },
  });
  return events;
}

export async function getEventById(id: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      registrations: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
      proofSubmissions: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!event) {
    throw new ServiceError('Event not found', 404);
  }
  return event;
}

interface CreateEventInput {
  title: string;
  description?: string | null;
  eventType: string;
  eventDate: string;
  registrationDeadline?: string | null;
}

export async function createEvent(input: CreateEventInput) {
  const event = await prisma.event.create({
    data: {
      title: input.title,
      description: input.description || null,
      eventType: input.eventType,
      eventDate: new Date(input.eventDate),
      registrationDeadline: input.registrationDeadline
        ? new Date(input.registrationDeadline)
        : null,
    },
  });
  return event;
}

interface UpdateEventInput {
  title?: string;
  description?: string | null;
  eventType?: string;
  eventDate?: string;
  registrationDeadline?: string | null;
}

export async function updateEvent(id: string, input: UpdateEventInput) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError('Event not found', 404);
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.eventType !== undefined) data.eventType = input.eventType;
  if (input.eventDate !== undefined) data.eventDate = new Date(input.eventDate);
  if (input.registrationDeadline !== undefined) {
    data.registrationDeadline = input.registrationDeadline
      ? new Date(input.registrationDeadline)
      : null;
  }

  const event = await prisma.event.update({
    where: { id },
    data,
  });
  return event;
}
