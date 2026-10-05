import express from 'express';
import request from 'supertest';

const mockFns = {
  eventFindUnique: jest.fn(),
  proofFindFirst: jest.fn(),
  proofFindUnique: jest.fn(),
  proofFindMany: jest.fn(),
  proofCreate: jest.fn(),
  proofUpdate: jest.fn(),
  uploadFileToDrive: jest.fn(),
  replaceFileOnDrive: jest.fn(),
};

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findUnique: (...a: any[]) => mockFns.eventFindUnique(...a) },
    proofSubmission: {
      findFirst: (...a: any[]) => mockFns.proofFindFirst(...a),
      findUnique: (...a: any[]) => mockFns.proofFindUnique(...a),
      findMany: (...a: any[]) => mockFns.proofFindMany(...a),
      create: (...a: any[]) => mockFns.proofCreate(...a),
      update: (...a: any[]) => mockFns.proofUpdate(...a),
    },
  },
}));

jest.mock('../services/s3.service', () => ({
  __esModule: true,
  uploadFileToDrive: (...a: any[]) => mockFns.uploadFileToDrive(...a),
  replaceFileOnDrive: (...a: any[]) => mockFns.replaceFileOnDrive(...a),
}));

jest.mock('../auth/rbac.middleware', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

import proofRoutes from '../routes/proofs.routes';
import { errorHandler } from '../middleware/error.middleware';

const STUDENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const EVENT_ID = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';
const PROOF_ID = 'c2aabb11-1e2d-4f0a-cc8f-8dd1df602c33';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { sub: STUDENT_ID, roleId: 'student-role' } as any;
    next();
  });
  app.use('/api/proofs', proofRoutes);
  app.use(errorHandler);
  return app;
}

const app = createApp();

beforeEach(() => {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
});

describe('POST /api/proofs — submit proof', () => {
  it('should return 201 on valid submission', async () => {
    mockFns.eventFindUnique.mockResolvedValue({ id: EVENT_ID, title: 'Hackathon' });
    mockFns.proofFindFirst.mockResolvedValue(null);
    mockFns.uploadFileToDrive.mockResolvedValue({
      fileId: 'drive-id',
      fileUrl: 'https://drive.google.com/file/d/drive-id/view',
    });
    mockFns.proofCreate.mockResolvedValue({
      id: PROOF_ID,
      eventId: EVENT_ID,
      studentId: STUDENT_ID,
      fileUrl: 'https://drive.google.com/file/d/drive-id/view',
      fileName: 'cert.png',
      status: 'PENDING',
    });

    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', EVENT_ID)
      .attach('file', Buffer.from('fake-png'), 'cert.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockFns.uploadFileToDrive).toHaveBeenCalledTimes(1);
    expect(mockFns.proofCreate).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when eventId is missing', async () => {
    const res = await request(app)
      .post('/api/proofs')
      .attach('file', Buffer.from('fake-png'), 'cert.png');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('eventId');
  });

  it('should return 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', EVENT_ID);

    expect(res.status).toBe(400);
  });

  it('should return 404 when event does not exist', async () => {
    mockFns.eventFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', 'nonexistent')
      .attach('file', Buffer.from('fake-png'), 'cert.png');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('Event not found');
  });

  it('should return 409 when student already has a submission for the event', async () => {
    mockFns.eventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockFns.proofFindFirst.mockResolvedValue({ id: PROOF_ID });

    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', EVENT_ID)
      .attach('file', Buffer.from('fake-png'), 'cert.png');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already have a submission');
    expect(mockFns.uploadFileToDrive).not.toHaveBeenCalled();
  });

  it('should return 400 when file type is not allowed', async () => {
    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', EVENT_ID)
      .attach('file', Buffer.from('not-a-real-exe'), {
        filename: 'malware.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('PNG, JPEG, GIF, and PDF');
  });
});

describe('PUT /api/proofs/:id/file — replace proof file', () => {
  it('should return 200 on successful replacement', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      studentId: STUDENT_ID,
      eventId: EVENT_ID,
      fileUrl: 'https://drive.google.com/file/d/old-id/view',
    });
    mockFns.replaceFileOnDrive.mockResolvedValue({
      fileId: 'old-id',
      fileUrl: 'https://drive.google.com/file/d/old-id/view',
    });
    mockFns.proofUpdate.mockResolvedValue({
      id: PROOF_ID,
      status: 'PENDING',
      remarks: null,
    });

    const res = await request(app)
      .put(`/api/proofs/${PROOF_ID}/file`)
      .attach('file', Buffer.from('new-png'), 'updated.png');

    expect(res.status).toBe(200);
    expect(mockFns.replaceFileOnDrive).toHaveBeenCalledTimes(1);
    expect(mockFns.proofUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING', remarks: null }),
      }),
    );
  });

  it('should return 404 when submission does not exist', async () => {
    mockFns.proofFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .put('/api/proofs/nonexistent/file')
      .attach('file', Buffer.from('new-png'), 'updated.png');

    expect(res.status).toBe(404);
  });

  it('should return 403 when student tries to replace another student\'s submission', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      studentId: 'different-student-id',
      eventId: EVENT_ID,
    });

    const res = await request(app)
      .put(`/api/proofs/${PROOF_ID}/file`)
      .attach('file', Buffer.from('new-png'), 'updated.png');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('only replace your own');
  });
});

describe('GET /api/proofs/my — own submissions', () => {
  it('should return own submissions', async () => {
    const submissions = [
      { id: PROOF_ID, eventId: EVENT_ID, studentId: STUDENT_ID, status: 'PENDING' },
    ];
    mockFns.proofFindMany.mockResolvedValue(submissions);

    const res = await request(app).get('/api/proofs/my');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockFns.proofFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: STUDENT_ID } }),
    );
  });
});

describe('GET /api/proofs — list all with filters', () => {
  it('should pass query filters to prisma', async () => {
    mockFns.proofFindMany.mockResolvedValue([]);

    const res = await request(app).get(
      `/api/proofs?eventId=${EVENT_ID}&status=APPROVED`,
    );

    expect(res.status).toBe(200);
    expect(mockFns.proofFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: EVENT_ID,
          status: 'APPROVED',
        }),
      }),
    );
  });

  it('should return empty array when no filters match', async () => {
    mockFns.proofFindMany.mockResolvedValue([]);

    const res = await request(app).get('/api/proofs');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/proofs/:id — single proof detail', () => {
  it('should return proof by id', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      status: 'PENDING',
    });

    const res = await request(app).get(`/api/proofs/${PROOF_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(PROOF_ID);
  });

  it('should return 404 when not found', async () => {
    mockFns.proofFindUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/proofs/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/proofs/:id/review — approve/reject', () => {
  it('should approve a submission', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      status: 'PENDING',
    });
    mockFns.proofUpdate.mockResolvedValue({
      id: PROOF_ID,
      status: 'APPROVED',
      remarks: 'Looks good',
    });

    const res = await request(app)
      .patch(`/api/proofs/${PROOF_ID}/review`)
      .send({ status: 'APPROVED', remarks: 'Looks good' });

    expect(res.status).toBe(200);
    expect(mockFns.proofUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED', remarks: 'Looks good' }),
      }),
    );
  });

  it('should reject a submission', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      status: 'PENDING',
    });
    mockFns.proofUpdate.mockResolvedValue({
      id: PROOF_ID,
      status: 'REJECTED',
      remarks: 'Blurry image',
    });

    const res = await request(app)
      .patch(`/api/proofs/${PROOF_ID}/review`)
      .send({ status: 'REJECTED', remarks: 'Blurry image' });

    expect(res.status).toBe(200);
  });

  it('should return 400 when status is invalid', async () => {
    const res = await request(app)
      .patch(`/api/proofs/${PROOF_ID}/review`)
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('APPROVED or REJECTED');
  });

  it('should return 400 when status is missing', async () => {
    const res = await request(app)
      .patch(`/api/proofs/${PROOF_ID}/review`)
      .send({ remarks: 'no status' });

    expect(res.status).toBe(400);
  });

  it('should return 404 when submission not found', async () => {
    mockFns.proofFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .patch('/api/proofs/nonexistent/review')
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(404);
  });
});

describe('Drive API error handling', () => {
  it('should return 500 when Drive upload fails', async () => {
    mockFns.eventFindUnique.mockResolvedValue({ id: EVENT_ID });
    mockFns.proofFindFirst.mockResolvedValue(null);
    mockFns.uploadFileToDrive.mockRejectedValue(new Error('Drive API timeout'));

    const res = await request(app)
      .post('/api/proofs')
      .field('eventId', EVENT_ID)
      .attach('file', Buffer.from('fake-png'), 'cert.png');

    expect(res.status).toBe(500);
  });

  it('should return 500 when Drive replace fails', async () => {
    mockFns.proofFindUnique.mockResolvedValue({
      id: PROOF_ID,
      studentId: STUDENT_ID,
      eventId: EVENT_ID,
      fileUrl: 'https://drive.google.com/file/d/old-id/view',
    });
    mockFns.replaceFileOnDrive.mockRejectedValue(new Error('Network error'));

    const res = await request(app)
      .put(`/api/proofs/${PROOF_ID}/file`)
      .attach('file', Buffer.from('new-png'), 'updated.png');

    expect(res.status).toBe(500);
  });
});
