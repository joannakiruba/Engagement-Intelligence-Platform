import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { requirePermission } from '../auth/rbac.middleware';
import { uploadFileToDrive, replaceFileOnDrive } from '../services/s3.service';

const router = Router();

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, GIF, and PDF files are allowed.'));
    }
  },
});

function handleUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    upload.single(fieldName)(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'File upload failed';
        return sendError(res, message, 400);
      }
      next();
    });
  };
}

const PROOF_INCLUDE = {
  event: { select: { id: true, title: true, eventType: true, eventDate: true } },
  student: { select: { id: true, name: true, email: true } },
};

// POST / — Submit proof for an event (student only, one per event)
router.post(
  '/',
  requirePermission('proofs:submit:self'),
  handleUpload('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user!.sub;
      const { eventId } = req.body;

      if (!eventId) return sendError(res, 'eventId is required', 400);
      if (!req.file) return sendError(res, 'No file uploaded', 400);

      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) return sendError(res, 'Event not found', 404);

      const existing = await prisma.proofSubmission.findFirst({
        where: { eventId, studentId },
      });
      if (existing) {
        return sendError(
          res,
          'You already have a submission for this event. Use the replace endpoint to update your file.',
          409,
        );
      }

      const driveFileName = `proof_${studentId}_${eventId}_${req.file.originalname}`;
      const { fileUrl } = await uploadFileToDrive(
        req.file.buffer,
        driveFileName,
        req.file.mimetype,
      );

      const submission = await prisma.proofSubmission.create({
        data: { eventId, studentId, fileUrl, fileName: req.file.originalname },
        include: PROOF_INCLUDE,
      });

      return sendSuccess(res, submission, 201);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id/file — Replace the file on an existing submission (student only, own)
router.put(
  '/:id/file',
  requirePermission('proofs:submit:self'),
  handleUpload('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentId = req.user!.sub;
      const { id } = req.params;

      const existing = await prisma.proofSubmission.findUnique({ where: { id } });
      if (!existing) return sendError(res, 'Submission not found', 404);
      if (existing.studentId !== studentId) {
        return sendError(res, 'You can only replace your own submissions', 403);
      }
      if (!req.file) return sendError(res, 'No file uploaded', 400);

      const driveFileName = `proof_${studentId}_${existing.eventId}_${req.file.originalname}`;
      const { fileUrl } = await replaceFileOnDrive(
        existing.fileUrl,
        req.file.buffer,
        driveFileName,
        req.file.mimetype,
      );

      const updated = await prisma.proofSubmission.update({
        where: { id },
        data: {
          fileUrl,
          fileName: req.file.originalname,
          status: 'PENDING',
          remarks: null,
        },
        include: PROOF_INCLUDE,
      });

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

// GET /my — Get own proof submissions (student)
router.get(
  '/my',
  requirePermission('proofs:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submissions = await prisma.proofSubmission.findMany({
        where: { studentId: req.user!.sub },
        include: PROOF_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      return sendSuccess(res, submissions);
    } catch (err) {
      next(err);
    }
  },
);

// GET / — List all proofs with optional filters (admin / trainer)
router.get(
  '/',
  requirePermission('proofs:read:any', 'proofs:read:batch', 'proofs:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const where: Record<string, unknown> = {};
      if (req.query.eventId) where.eventId = String(req.query.eventId);
      if (req.query.studentId) where.studentId = String(req.query.studentId);
      if (req.query.status) where.status = String(req.query.status);

      const submissions = await prisma.proofSubmission.findMany({
        where,
        include: PROOF_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(res, submissions);
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id — Get a single proof detail
router.get(
  '/:id',
  requirePermission('proofs:read:any', 'proofs:read:batch', 'proofs:read:own'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const submission = await prisma.proofSubmission.findUnique({
        where: { id: req.params.id },
        include: PROOF_INCLUDE,
      });
      if (!submission) return sendError(res, 'Submission not found', 404);
      return sendSuccess(res, submission);
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /:id/review — Approve or reject a proof (admin / trainer)
router.patch(
  '/:id/review',
  requirePermission('proofs:approve:any', 'proofs:approve:batch'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;

      if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
        return sendError(res, 'status must be APPROVED or REJECTED', 400);
      }

      const existing = await prisma.proofSubmission.findUnique({ where: { id } });
      if (!existing) return sendError(res, 'Submission not found', 404);

      const updated = await prisma.proofSubmission.update({
        where: { id },
        data: { status, remarks: remarks || null },
        include: PROOF_INCLUDE,
      });

      return sendSuccess(res, updated);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
