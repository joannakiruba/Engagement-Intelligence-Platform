import { Request, Response, NextFunction } from 'express';

jest.mock('../services/feedback.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  listFeedback: jest.fn(),
  getFeedbackById: jest.fn(),
  createFeedback: jest.fn(),
  bulkCreateFeedback: jest.fn(),
  updateFeedback: jest.fn(),
  deleteFeedback: jest.fn(),
}));

import {
  listFeedbackHandler,
  getFeedbackHandler,
  createFeedbackHandler,
  bulkCreateFeedbackHandler,
  updateFeedbackHandler,
  deleteFeedbackHandler,
} from '../controllers/feedback.controller';

import {
  ServiceError,
  listFeedback,
  getFeedbackById,
  createFeedback,
  bulkCreateFeedback,
  updateFeedback,
  deleteFeedback,
} from '../services/feedback.service';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID2 = 'b1ffcd00-0d1c-4ef9-bb7e-7cc0ce491b22';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: { sub: UUID, roleId: 'role-1', permissions: ['feedback:read:any'] },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const next: NextFunction = jest.fn();

beforeEach(() => jest.clearAllMocks());

describe('Feedback Controller — listFeedbackHandler', () => {
  it('calls listFeedback with filters from query', async () => {
    (listFeedback as jest.Mock).mockResolvedValue([]);
    const req = mockReq({ query: { sessionId: UUID, studentId: UUID2 } });
    const res = mockRes();

    await listFeedbackHandler(req, res, next);

    expect(listFeedback).toHaveBeenCalledWith({ sessionId: UUID, studentId: UUID2 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes empty filters when no query params', async () => {
    (listFeedback as jest.Mock).mockResolvedValue([]);
    const req = mockReq();
    const res = mockRes();

    await listFeedbackHandler(req, res, next);

    expect(listFeedback).toHaveBeenCalledWith({});
  });

  it('forces students to their own received feedback regardless of requested student filter', async () => {
    (listFeedback as jest.Mock).mockResolvedValue([]);
    const req = mockReq({
      query: { studentId: UUID2 },
      user: { sub: UUID, roleId: 'student-role', permissions: ['feedback:read:own_received'] } as any,
    });

    await listFeedbackHandler(req, mockRes(), next);

    expect(listFeedback).toHaveBeenCalledWith({ studentId: UUID });
  });
});

describe('Feedback Controller — getFeedbackHandler', () => {
  it('returns feedback by id', async () => {
    const fb = { id: UUID, effortRating: 4 };
    (getFeedbackById as jest.Mock).mockResolvedValue(fb);
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await getFeedbackHandler(req, res, next);

    expect(getFeedbackById).toHaveBeenCalledWith(UUID);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: fb })
    );
  });

  it('hides another student\'s feedback from a student', async () => {
    (getFeedbackById as jest.Mock).mockResolvedValue({ id: UUID2, studentId: UUID2 });
    const req = mockReq({
      params: { id: UUID2 },
      user: { sub: UUID, roleId: 'student-role', permissions: ['feedback:read:own_received'] } as any,
    });
    const res = mockRes();

    await getFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 via ServiceError', async () => {
    (getFeedbackById as jest.Mock).mockRejectedValue(new ServiceError('Not found', 404));
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await getFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Feedback Controller — createFeedbackHandler', () => {
  it('uses req.user.sub as trainerId', async () => {
    (createFeedback as jest.Mock).mockResolvedValue({ id: 'fb-1' });
    const req = mockReq({
      body: { sessionId: UUID, studentId: UUID2, effortRating: 4, participationRating: 3, comments: 'Good' },
    });
    const res = mockRes();

    await createFeedbackHandler(req, res, next);

    expect(createFeedback).toHaveBeenCalledWith(UUID, UUID2, UUID, 4, 3, 'Good');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 409 for duplicate feedback', async () => {
    (createFeedback as jest.Mock).mockRejectedValue(new ServiceError('Already exists', 409));
    const req = mockReq({
      body: { sessionId: UUID, studentId: UUID2, effortRating: 4, participationRating: 3 },
    });
    const res = mockRes();

    await createFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('passes unexpected errors to next()', async () => {
    const err = new Error('DB down');
    (createFeedback as jest.Mock).mockRejectedValue(err);
    const req = mockReq({ body: { sessionId: UUID, studentId: UUID2, effortRating: 3, participationRating: 3 } });
    const res = mockRes();

    await createFeedbackHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('Feedback Controller — bulkCreateFeedbackHandler', () => {
  it('uses req.user.sub as trainerId and returns 201 on full success', async () => {
    (bulkCreateFeedback as jest.Mock).mockResolvedValue({ total: 2, created: 2, skipped: [] });
    const records = [
      { studentId: UUID, effortRating: 4, participationRating: 3 },
      { studentId: UUID2, effortRating: 5, participationRating: 5 },
    ];
    const req = mockReq({ body: { sessionId: UUID, records } });
    const res = mockRes();

    await bulkCreateFeedbackHandler(req, res, next);

    expect(bulkCreateFeedback).toHaveBeenCalledWith(UUID, UUID, records);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 207 when some records are skipped', async () => {
    (bulkCreateFeedback as jest.Mock).mockResolvedValue({
      total: 2,
      created: 1,
      skipped: [{ studentId: UUID2, reason: 'Already exists' }],
    });
    const req = mockReq({ body: { sessionId: UUID, records: [{ studentId: UUID, effortRating: 3, participationRating: 3 }] } });
    const res = mockRes();

    await bulkCreateFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(207);
  });
});

describe('Feedback Controller — updateFeedbackHandler', () => {
  it('passes id and body to updateFeedback', async () => {
    (updateFeedback as jest.Mock).mockResolvedValue({ id: UUID, effortRating: 5 });
    const req = mockReq({ params: { id: UUID }, body: { effortRating: 5 } });
    const res = mockRes();

    await updateFeedbackHandler(req, res, next);

    expect(updateFeedback).toHaveBeenCalledWith(UUID, UUID, { effortRating: 5 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when record not found', async () => {
    (updateFeedback as jest.Mock).mockRejectedValue(new ServiceError('Not found', 404));
    const req = mockReq({ params: { id: 'missing' }, body: { effortRating: 3 } });
    const res = mockRes();

    await updateFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Feedback Controller — deleteFeedbackHandler', () => {
  it('deletes and returns success', async () => {
    (deleteFeedback as jest.Mock).mockResolvedValue({ message: 'Deleted.' });
    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();

    await deleteFeedbackHandler(req, res, next);

    expect(deleteFeedback).toHaveBeenCalledWith(UUID, UUID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when not found', async () => {
    (deleteFeedback as jest.Mock).mockRejectedValue(new ServiceError('Not found', 404));
    const req = mockReq({ params: { id: 'missing' } });
    const res = mockRes();

    await deleteFeedbackHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
