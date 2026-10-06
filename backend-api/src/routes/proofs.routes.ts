import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requirePermission } from '../auth/rbac.middleware';
import { sendError } from '../utils/response';
import { validate } from '../middleware/validate.middleware';
import { submitProofSchema, reviewProofSchema } from '../validators/proofs.validator';
import {
  submitProofHandler,
  replaceProofFileHandler,
  getMyProofsHandler,
  listProofsHandler,
  getProofHandler,
  reviewProofHandler,
} from '../controllers/proofs.controller';

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

router.post('/', requirePermission('proofs:submit:self'), handleUpload('file'), validate(submitProofSchema), submitProofHandler);
router.put('/:id/file', requirePermission('proofs:submit:self'), handleUpload('file'), replaceProofFileHandler);
router.get('/my', requirePermission('proofs:read:own'), getMyProofsHandler);
router.get('/', requirePermission('proofs:read:any', 'proofs:read:batch', 'proofs:read:own'), listProofsHandler);
router.get('/:id', requirePermission('proofs:read:any', 'proofs:read:batch', 'proofs:read:own'), getProofHandler);
router.patch('/:id/review', requirePermission('proofs:approve:any', 'proofs:approve:batch'), validate(reviewProofSchema), reviewProofHandler);

export default router;
