import prisma from '../lib/prisma';

export class ServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

const ASSIGNMENT_INCLUDE = {
  mentor: { select: { id: true, name: true, email: true } },
  student: { select: { id: true, name: true, email: true } },
};

export async function listAssignments(filters?: { mentorId?: string; studentId?: string }) {
  const where: Record<string, string> = {};
  if (filters?.mentorId) where.mentorId = filters.mentorId;
  if (filters?.studentId) where.studentId = filters.studentId;

  return prisma.mentorAssignment.findMany({
    where,
    include: ASSIGNMENT_INCLUDE,
    orderBy: { assignedAt: 'desc' },
  });
}

export async function getAssignmentById(id: string) {
  const assignment = await prisma.mentorAssignment.findUnique({
    where: { id },
    include: ASSIGNMENT_INCLUDE,
  });
  if (!assignment) throw new ServiceError(404, 'Mentor assignment not found.');
  return assignment;
}

export async function createAssignment(mentorId: string, studentId: string) {
  const mentor = await prisma.user.findUnique({ where: { id: mentorId } });
  if (!mentor) throw new ServiceError(404, 'Mentor not found.');

  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new ServiceError(404, 'Student not found.');

  const existing = await prisma.mentorAssignment.findUnique({
    where: { mentorId_studentId: { mentorId, studentId } },
  });
  if (existing) throw new ServiceError(409, 'This mentor-student assignment already exists.');

  return prisma.mentorAssignment.create({
    data: { mentorId, studentId },
  });
}

export async function deleteAssignment(id: string) {
  const existing = await prisma.mentorAssignment.findUnique({ where: { id } });
  if (!existing) throw new ServiceError(404, 'Mentor assignment not found.');

  await prisma.mentorAssignment.delete({ where: { id } });
  return { message: 'Mentor assignment deleted.' };
}
