import { Request, Response, NextFunction } from 'express';

jest.mock('../services/training-history.service', () => ({
  ServiceError: class ServiceError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
  getTrainingHistory: jest.fn(),
}));

import { getMyTrainingHistoryHandler } from '../controllers/training-history.controller';
import {
  ServiceError,
  getTrainingHistory,
} from '../services/training-history.service';

const STUDENT_ID = 'student-123';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    query: {},
    user: { sub: STUDENT_ID, roleId: 'role-student', permissions: [] },
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

describe('Training History Controller', () => {
  describe('getMyTrainingHistoryHandler', () => {
    it('should return paginated training history', async () => {
      const mockItems = [
        {
          type: 'SESSION' as const,
          date: new Date('2026-10-07T10:00:00.000Z'),
          session: { id: 'session-1', title: 'Advanced DSA', topic: 'Dynamic Programming' },
          attendance: 'PRESENT' as const,
        },
        {
          type: 'ASSESSMENT' as const,
          date: new Date('2026-10-06T15:00:00.000Z'),
          assessment: { id: 'assessment-1', title: 'DP Quiz', type: 'QUIZ' as const },
          score: { obtained: 86, maximum: 100, percentage: 86 },
          remarks: null,
        },
      ];

      (getTrainingHistory as jest.Mock).mockResolvedValue({
        items: mockItems,
        total: 2,
      });

      const req = mockReq({ query: { page: '1', limit: '20' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(getTrainingHistory).toHaveBeenCalledWith(STUDENT_ID, {}, 1, 20);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockItems,
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          pages: 1,
        },
      });
    });

    it('should use default pagination if not provided', async () => {
      (getTrainingHistory as jest.Mock).mockResolvedValue({ items: [], total: 0 });

      const req = mockReq({ query: {} });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(getTrainingHistory).toHaveBeenCalledWith(STUDENT_ID, {}, 1, 20);
    });

    it('should apply date filters', async () => {
      (getTrainingHistory as jest.Mock).mockResolvedValue({ items: [], total: 0 });

      const req = mockReq({ query: { from: '2026-09-01', to: '2026-10-01' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(getTrainingHistory).toHaveBeenCalledWith(
        STUDENT_ID,
        { from: '2026-09-01', to: '2026-10-01' },
        1,
        20
      );
    });

    it('should reject invalid page number', async () => {
      const req = mockReq({ query: { page: '0' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid page number',
      });
      expect(getTrainingHistory).not.toHaveBeenCalled();
    });

    it('should reject invalid limit', async () => {
      const req = mockReq({ query: { limit: '0' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid limit (must be between 1 and 100)',
      });
      expect(getTrainingHistory).not.toHaveBeenCalled();
    });

    it('should reject limit over 100', async () => {
      const req = mockReq({ query: { limit: '101' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid limit (must be between 1 and 100)',
      });
    });

    it('should reject invalid from date', async () => {
      const req = mockReq({ query: { from: 'not-a-date' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid from date',
      });
    });

    it('should reject invalid to date', async () => {
      const req = mockReq({ query: { to: 'not-a-date' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid to date',
      });
    });

    it('should reject from date after to date', async () => {
      const req = mockReq({ query: { from: '2026-10-01', to: '2026-09-01' } });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'from date must be before to date',
      });
    });

    it('should handle ServiceError correctly', async () => {
      (getTrainingHistory as jest.Mock).mockRejectedValue(
        new ServiceError('Student not found', 404)
      );

      const req = mockReq();
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Student not found',
      });
    });

    it('should pass unknown errors to next middleware', async () => {
      const unknownError = new Error('Database connection failed');
      (getTrainingHistory as jest.Mock).mockRejectedValue(unknownError);

      const req = mockReq();
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(unknownError);
    });

    it('should extract studentId from JWT', async () => {
      (getTrainingHistory as jest.Mock).mockResolvedValue({ items: [], total: 0 });

      const differentStudentId = 'different-student-456';
      const req = mockReq({
        user: { sub: differentStudentId, roleId: 'role-student', permissions: [] },
      });
      const res = mockRes();

      await getMyTrainingHistoryHandler(req, res, next);

      expect(getTrainingHistory).toHaveBeenCalledWith(differentStudentId, {}, 1, 20);
    });
  });
});
