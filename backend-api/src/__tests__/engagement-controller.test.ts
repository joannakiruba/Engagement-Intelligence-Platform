import { Request, Response, NextFunction } from 'express';

jest.mock('../services/engagement.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  getDashboard: jest.fn(),
  getBatchEngagement: jest.fn(),
  getStudentEngagement: jest.fn(),
  getBatchTrends: jest.fn(),
}));

import {
  dashboardHandler,
  batchEngagementHandler,
  studentEngagementHandler,
  batchTrendsHandler,
} from '../controllers/engagement.controller';

import {
  ServiceError,
  getDashboard,
  getBatchEngagement,
  getStudentEngagement,
  getBatchTrends,
} from '../services/engagement.service';

const UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: { sub: UUID, roleId: 'role-1' },
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

describe('dashboardHandler', () => {
  it('returns dashboard data with no filters', async () => {
    const data = { totalStudents: 50, totalBatches: 4, batches: [] };
    (getDashboard as jest.Mock).mockResolvedValue(data);

    const req = mockReq({ query: {} });
    const res = mockRes();

    await dashboardHandler(req, res, next);

    expect(getDashboard).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data }));
  });

  it('passes from/to filters', async () => {
    (getDashboard as jest.Mock).mockResolvedValue({});

    const req = mockReq({ query: { from: '2026-01-01', to: '2026-06-30' } });
    const res = mockRes();

    await dashboardHandler(req, res, next);

    expect(getDashboard).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-06-30' });
  });

  it('forwards ServiceError', async () => {
    (getDashboard as jest.Mock).mockRejectedValue(new ServiceError('Server error', 500));

    const req = mockReq();
    const res = mockRes();

    await dashboardHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('batchEngagementHandler', () => {
  it('returns batch engagement data', async () => {
    const data = { batch: { id: UUID, name: 'Batch 1' }, students: [] };
    (getBatchEngagement as jest.Mock).mockResolvedValue(data);

    const req = mockReq({ params: { batchId: UUID } as any, query: {} });
    const res = mockRes();

    await batchEngagementHandler(req, res, next);

    expect(getBatchEngagement).toHaveBeenCalledWith(UUID, {});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes date filters', async () => {
    (getBatchEngagement as jest.Mock).mockResolvedValue({});

    const req = mockReq({
      params: { batchId: UUID } as any,
      query: { from: '2026-01-01' },
    });
    const res = mockRes();

    await batchEngagementHandler(req, res, next);

    expect(getBatchEngagement).toHaveBeenCalledWith(UUID, { from: '2026-01-01' });
  });

  it('forwards 404 for unknown batch', async () => {
    (getBatchEngagement as jest.Mock).mockRejectedValue(new ServiceError('Batch not found', 404));

    const req = mockReq({ params: { batchId: 'bad-id' } as any });
    const res = mockRes();

    await batchEngagementHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('studentEngagementHandler', () => {
  it('returns student engagement data', async () => {
    const data = { student: { id: UUID, name: 'Test' }, attendance: {} };
    (getStudentEngagement as jest.Mock).mockResolvedValue(data);

    const req = mockReq({ params: { studentId: UUID } as any, query: {} });
    const res = mockRes();

    await studentEngagementHandler(req, res, next);

    expect(getStudentEngagement).toHaveBeenCalledWith(UUID, {});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes batchId and date filters', async () => {
    (getStudentEngagement as jest.Mock).mockResolvedValue({});

    const req = mockReq({
      params: { studentId: UUID } as any,
      query: { batchId: UUID, from: '2026-01-01', to: '2026-12-31' },
    });
    const res = mockRes();

    await studentEngagementHandler(req, res, next);

    expect(getStudentEngagement).toHaveBeenCalledWith(UUID, {
      batchId: UUID,
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('forwards 404 for unknown student', async () => {
    (getStudentEngagement as jest.Mock).mockRejectedValue(new ServiceError('Student not found', 404));

    const req = mockReq({ params: { studentId: 'bad' } as any });
    const res = mockRes();

    await studentEngagementHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('batchTrendsHandler', () => {
  it('returns batch trends data', async () => {
    const data = { batch: { id: UUID }, attendance: [], assessments: [], feedback: [] };
    (getBatchTrends as jest.Mock).mockResolvedValue(data);

    const req = mockReq({ params: { batchId: UUID } as any, query: {} });
    const res = mockRes();

    await batchTrendsHandler(req, res, next);

    expect(getBatchTrends).toHaveBeenCalledWith(UUID, {});
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('passes date filters', async () => {
    (getBatchTrends as jest.Mock).mockResolvedValue({});

    const req = mockReq({
      params: { batchId: UUID } as any,
      query: { from: '2026-03-01', to: '2026-09-30' },
    });
    const res = mockRes();

    await batchTrendsHandler(req, res, next);

    expect(getBatchTrends).toHaveBeenCalledWith(UUID, { from: '2026-03-01', to: '2026-09-30' });
  });

  it('forwards unknown errors to next', async () => {
    (getBatchTrends as jest.Mock).mockRejectedValue(new Error('DB down'));

    const req = mockReq({ params: { batchId: UUID } as any });
    const res = mockRes();

    await batchTrendsHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
