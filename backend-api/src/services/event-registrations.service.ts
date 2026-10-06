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

const REGISTRATION_INCLUDE = {
  event: { select: { id: true, title: true, eventType: true, eventDate: true } },
};

const REGISTRATION_INCLUDE_FULL = {
  event: { select: { id: true, title: true, eventType: true, eventDate: true } },
  student: { select: { id: true, name: true, email: true } },
};

export async function registerForEvent(studentId: string, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new ServiceError('Event not found', 404);
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    throw new ServiceError('Registration deadline has passed', 400);
  }

  const existing = await prisma.eventRegistration.findUnique({
    where: { eventId_studentId: { eventId, studentId } },
  });
  if (existing) {
    throw new ServiceError('Already registered for this event', 409);
  }

  const registration = await prisma.eventRegistration.create({
    data: { eventId, studentId },
    include: REGISTRATION_INCLUDE,
  });

  return registration;
}

export async function getMyRegistrations(studentId: string) {
  const registrations = await prisma.eventRegistration.findMany({
    where: { studentId },
    include: REGISTRATION_INCLUDE,
    orderBy: { registeredAt: 'desc' },
  });
  return registrations;
}

export async function listRegistrations(filters?: { eventId?: string; studentId?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.eventId) where.eventId = filters.eventId;
  if (filters?.studentId) where.studentId = filters.studentId;

  const registrations = await prisma.eventRegistration.findMany({
    where,
    include: REGISTRATION_INCLUDE_FULL,
    orderBy: { registeredAt: 'desc' },
  });
  return registrations;
}

export async function cancelRegistration(studentId: string, registrationId: string) {
  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new ServiceError('Registration not found', 404);
  }
  if (registration.studentId !== studentId) {
    throw new ServiceError('You can only cancel your own registrations', 403);
  }

  await prisma.eventRegistration.delete({ where: { id: registration.id } });
  return { message: 'Registration cancelled' };
}
