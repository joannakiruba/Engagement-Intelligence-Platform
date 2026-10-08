import prisma from '../lib/prisma';
import {
  getTrainingHistory,
  ServiceError,
} from '../services/training-history.service';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    batchMember: {
      findMany: jest.fn(),
    },
    session: {
      findMany: jest.fn(),
    },
    assessment: {
      findMany: jest.fn(),
    },
  },
}));

const STUDENT_ID = 'student-123';
const BATCH_ID = 'batch-abc';
const SESSION_ID_1 = 'session-1';
const SESSION_ID_2 = 'session-2';
const ASSESSMENT_ID_1 = 'assessment-1';
const ASSESSMENT_ID_2 = 'assessment-2';

describe('Training History Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTrainingHistory', () => {
    it('should return empty history for non-existent student', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(getTrainingHistory(STUDENT_ID, {}, 1, 20)).rejects.toThrow(ServiceError);
      await expect(getTrainingHistory(STUDENT_ID, {}, 1, 20)).rejects.toThrow('Student not found');
    });

    it('should return empty history for student with no batches', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result).toEqual({ items: [], total: 0 });
    });

    it('should return combined session and assessment timeline', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      const session1Date = new Date('2026-10-07T10:00:00.000Z');
      const session2Date = new Date('2026-10-06T10:00:00.000Z');
      const assessment1Date = new Date('2026-10-07T15:00:00.000Z');
      const assessment2Date = new Date('2026-10-05T14:00:00.000Z');

      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        {
          id: SESSION_ID_1,
          title: 'Advanced DSA',
          topic: 'Dynamic Programming',
          scheduledDate: session1Date,
          attendances: [{ status: 'PRESENT' }],
        },
        {
          id: SESSION_ID_2,
          title: 'System Design',
          topic: 'Scalability Patterns',
          scheduledDate: session2Date,
          attendances: [{ status: 'LATE' }],
        },
      ]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([
        {
          id: ASSESSMENT_ID_1,
          title: 'DP Assessment',
          type: 'QUIZ',
          maxScore: 100,
          assessmentDate: assessment1Date,
          results: [{ score: 86, remarks: 'Good work' }],
        },
        {
          id: ASSESSMENT_ID_2,
          title: 'System Design Quiz',
          type: 'QUIZ',
          maxScore: 50,
          assessmentDate: assessment2Date,
          results: [{ score: 42, remarks: null }],
        },
      ]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result.total).toBe(4);
      expect(result.items).toHaveLength(4);

      // Check chronological order (newest first)
      expect(result.items[0]).toMatchObject({
        type: 'ASSESSMENT',
        date: assessment1Date,
        assessment: { id: ASSESSMENT_ID_1, title: 'DP Assessment', type: 'QUIZ' },
        score: { obtained: 86, maximum: 100, percentage: 86 },
        remarks: 'Good work',
      });

      expect(result.items[1]).toMatchObject({
        type: 'SESSION',
        date: session1Date,
        session: { id: SESSION_ID_1, title: 'Advanced DSA', topic: 'Dynamic Programming' },
        attendance: 'PRESENT',
      });

      expect(result.items[2]).toMatchObject({
        type: 'SESSION',
        date: session2Date,
        session: { id: SESSION_ID_2, title: 'System Design', topic: 'Scalability Patterns' },
        attendance: 'LATE',
      });

      expect(result.items[3]).toMatchObject({
        type: 'ASSESSMENT',
        date: assessment2Date,
        assessment: { id: ASSESSMENT_ID_2, title: 'System Design Quiz', type: 'QUIZ' },
        score: { obtained: 42, maximum: 50, percentage: 84 },
        remarks: null,
      });
    });

    it('should handle session with no attendance', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        {
          id: SESSION_ID_1,
          title: 'Advanced DSA',
          topic: 'Dynamic Programming',
          scheduledDate: new Date('2026-10-07T10:00:00.000Z'),
          attendances: [],
        },
      ]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result.items[0]).toMatchObject({
        type: 'SESSION',
        attendance: null,
      });
    });

    it('should handle assessment with no result', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([
        {
          id: ASSESSMENT_ID_1,
          title: 'DP Assessment',
          type: 'QUIZ',
          maxScore: 100,
          assessmentDate: new Date('2026-10-07T15:00:00.000Z'),
          results: [],
        },
      ]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result.items[0]).toMatchObject({
        type: 'ASSESSMENT',
        score: null,
        remarks: null,
      });
    });

    it('should resolve attendance status correctly with multiple windows', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        {
          id: SESSION_ID_1,
          title: 'Advanced DSA',
          topic: 'Dynamic Programming',
          scheduledDate: new Date('2026-10-07T10:00:00.000Z'),
          attendances: [{ status: 'PRESENT' }, { status: 'LATE' }],
        },
      ]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      // PRESENT takes priority over LATE
      expect(result.items[0].attendance).toBe('PRESENT');
    });

    it('should prioritize LATE over ABSENT', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      (prisma.session.findMany as jest.Mock).mockResolvedValue([
        {
          id: SESSION_ID_1,
          title: 'Advanced DSA',
          topic: null,
          scheduledDate: new Date('2026-10-07T10:00:00.000Z'),
          attendances: [{ status: 'ABSENT' }, { status: 'LATE' }],
        },
      ]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result.items[0].attendance).toBe('LATE');
    });

    it('should handle zero maxScore in assessment', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([
        {
          id: ASSESSMENT_ID_1,
          title: 'Bonus Quiz',
          type: 'QUIZ',
          maxScore: 0,
          assessmentDate: new Date('2026-10-07T15:00:00.000Z'),
          results: [{ score: 0, remarks: null }],
        },
      ]);

      const result = await getTrainingHistory(STUDENT_ID, {}, 1, 20);

      expect(result.items[0].score).toMatchObject({
        obtained: 0,
        maximum: 0,
        percentage: 0, // Should not be NaN or Infinity
      });
    });

    it('should paginate correctly', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      const sessions = Array.from({ length: 15 }, (_, i) => ({
        id: `session-${i}`,
        title: `Session ${i}`,
        topic: `Topic ${i}`,
        scheduledDate: new Date(`2026-10-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`),
        attendances: [{ status: 'PRESENT' }],
      }));

      (prisma.session.findMany as jest.Mock).mockResolvedValue(sessions);
      (prisma.assessment.findMany as jest.Mock).mockResolvedValue([]);

      const page1 = await getTrainingHistory(STUDENT_ID, {}, 1, 10);
      expect(page1.items).toHaveLength(10);
      expect(page1.total).toBe(15);

      const page2 = await getTrainingHistory(STUDENT_ID, {}, 2, 10);
      expect(page2.items).toHaveLength(5);
      expect(page2.total).toBe(15);
    });

    it('should apply date filters correctly', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      await getTrainingHistory(STUDENT_ID, { from: '2026-09-01', to: '2026-10-01' }, 1, 20);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: {
              gte: new Date('2026-09-01'),
              lte: new Date('2026-10-01'),
            },
          }),
        })
      );

      expect(prisma.assessment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assessmentDate: {
              gte: new Date('2026-09-01'),
              lte: new Date('2026-10-01'),
            },
          }),
        })
      );
    });

    it('should apply from filter only', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      await getTrainingHistory(STUDENT_ID, { from: '2026-09-01' }, 1, 20);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: {
              gte: new Date('2026-09-01'),
            },
          }),
        })
      );
    });

    it('should apply to filter only', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: STUDENT_ID });
      (prisma.batchMember.findMany as jest.Mock).mockResolvedValue([{ batchId: BATCH_ID }]);

      await getTrainingHistory(STUDENT_ID, { to: '2026-10-01' }, 1, 20);

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledDate: {
              lte: new Date('2026-10-01'),
            },
          }),
        })
      );
    });
  });
});
