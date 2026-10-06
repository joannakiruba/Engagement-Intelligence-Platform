const mockAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockQuit = jest.fn().mockResolvedValue(undefined);

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: (...args: any[]) => mockAdd(...args),
    close: (...args: any[]) => mockClose(...args),
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: (...args: any[]) => mockQuit(...args),
  }));
});

jest.mock('../config', () => ({
  config: {
    redis: { host: 'localhost', port: 6379, password: undefined, db: 0 },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  queueActivationEmail,
  queuePasswordResetEmail,
  queueMentorAlert,
  queueWeeklyReport,
  closeQueues,
} from '../jobs/queue';

beforeEach(() => {
  mockAdd.mockClear();
  mockClose.mockClear();
  mockQuit.mockClear();
});

// ─── queueActivationEmail ───

describe('queueActivationEmail', () => {
  const data = {
    userId: 'user-1',
    email: 'student@test.com',
    name: 'Alice',
    token: 'tok-123',
  };

  it('adds job to email queue with activation type', async () => {
    await queueActivationEmail(data);
    expect(mockAdd).toHaveBeenCalledWith(
      'activation-email',
      data,
      expect.objectContaining({
        jobId: expect.stringContaining('activation-user-1-'),
      }),
    );
  });
});

// ─── queuePasswordResetEmail ───

describe('queuePasswordResetEmail', () => {
  const data = {
    userId: 'user-2',
    email: 'user@test.com',
    name: 'Bob',
    token: 'reset-456',
  };

  it('adds job to email queue with password-reset type', async () => {
    await queuePasswordResetEmail(data);
    expect(mockAdd).toHaveBeenCalledWith(
      'password-reset-email',
      data,
      expect.objectContaining({
        jobId: expect.stringContaining('password-reset-user-2-'),
      }),
    );
  });
});

// ─── queueMentorAlert ───

describe('queueMentorAlert', () => {
  const data = {
    mentorId: 'mentor-1',
    mentorEmail: 'mentor@test.com',
    mentorName: 'Dr. Smith',
    studentId: 'stu-1',
    studentName: 'Charlie',
    riskLevel: 'HIGH',
    riskScore: 75,
  };

  it('adds job to mentor-alert queue', async () => {
    await queueMentorAlert(data);
    expect(mockAdd).toHaveBeenCalledWith(
      'mentor-alert',
      data,
      expect.objectContaining({
        jobId: expect.stringContaining('mentor-alert-stu-1-'),
      }),
    );
  });
});

// ─── queueWeeklyReport ───

describe('queueWeeklyReport', () => {
  const data = {
    mentorId: 'mentor-1',
    weekStart: new Date('2026-09-21'),
    weekEnd: new Date('2026-09-28'),
  };

  it('adds job to weekly-report queue', async () => {
    await queueWeeklyReport(data);
    expect(mockAdd).toHaveBeenCalledWith(
      'weekly-report',
      data,
      expect.objectContaining({
        jobId: expect.stringContaining('weekly-report-mentor-1-'),
      }),
    );
  });
});

// ─── closeQueues ───

describe('closeQueues', () => {
  it('closes all queues and redis', async () => {
    await closeQueues();
    expect(mockClose).toHaveBeenCalledTimes(4);
    expect(mockQuit).toHaveBeenCalledTimes(1);
  });
});
