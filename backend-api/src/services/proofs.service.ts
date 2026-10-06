import prisma from '../lib/prisma';
import type { ProofStatus } from '@prisma/client';
import { uploadFileToDrive, replaceFileOnDrive } from './s3.service';

export class ServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ServiceError';
  }
}

const PROOF_INCLUDE = {
  event: { select: { id: true, title: true, eventType: true, eventDate: true } },
  student: { select: { id: true, name: true, email: true } },
};

export async function submitProof(
  studentId: string,
  eventId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ServiceError(404, 'Event not found');

  const existing = await prisma.proofSubmission.findFirst({
    where: { eventId, studentId },
  });
  if (existing) {
    throw new ServiceError(
      409,
      'You already have a submission for this event. Use the replace endpoint to update your file.',
    );
  }

  const driveFileName = `proof_${studentId}_${eventId}_${file.originalname}`;
  const { fileUrl } = await uploadFileToDrive(file.buffer, driveFileName, file.mimetype);

  return prisma.proofSubmission.create({
    data: { eventId, studentId, fileUrl, fileName: file.originalname },
    include: PROOF_INCLUDE,
  });
}

export async function replaceProofFile(
  studentId: string,
  proofId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const existing = await prisma.proofSubmission.findUnique({ where: { id: proofId } });
  if (!existing) throw new ServiceError(404, 'Submission not found');
  if (existing.studentId !== studentId) {
    throw new ServiceError(403, 'You can only replace your own submissions');
  }

  const driveFileName = `proof_${studentId}_${existing.eventId}_${file.originalname}`;
  const { fileUrl } = await replaceFileOnDrive(
    existing.fileUrl,
    file.buffer,
    driveFileName,
    file.mimetype,
  );

  return prisma.proofSubmission.update({
    where: { id: proofId },
    data: { fileUrl, fileName: file.originalname, status: 'PENDING', remarks: null },
    include: PROOF_INCLUDE,
  });
}

export async function getMyProofs(studentId: string) {
  return prisma.proofSubmission.findMany({
    where: { studentId },
    include: PROOF_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listProofs(filters?: { eventId?: string; studentId?: string; status?: string }) {
  const where: Record<string, unknown> = {};
  if (filters?.eventId) where.eventId = filters.eventId;
  if (filters?.studentId) where.studentId = filters.studentId;
  if (filters?.status) where.status = filters.status;

  return prisma.proofSubmission.findMany({
    where,
    include: PROOF_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getProofById(id: string) {
  const submission = await prisma.proofSubmission.findUnique({
    where: { id },
    include: PROOF_INCLUDE,
  });
  if (!submission) throw new ServiceError(404, 'Submission not found');
  return submission;
}

export async function reviewProof(id: string, status: string, remarks?: string) {
  const existing = await prisma.proofSubmission.findUnique({ where: { id } });
  if (!existing) throw new ServiceError(404, 'Submission not found');

  return prisma.proofSubmission.update({
    where: { id },
    data: { status: status as ProofStatus, remarks: remarks || null },
    include: PROOF_INCLUDE,
  });
}
