const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    close: jest.fn(),
  })),
}));

jest.mock('../config', () => ({
  config: {
    frontendUrl: 'http://localhost:5173',
    email: {
      smtpHost: undefined,
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: undefined,
      smtpPass: undefined,
      emailFrom: 'HOPE Platform <noreply@example.com>',
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  sendActivationEmail,
  sendPasswordResetEmail,
  sendMentorAlert,
  sendWeeklyReport,
  closeEmailTransporter,
} from '../services/email.service';

beforeEach(() => {
  mockSendMail.mockReset();
  mockSendMail.mockResolvedValue({ messageId: 'test-id' });
});

// ─── sendActivationEmail ───

describe('sendActivationEmail', () => {
  const data = { to: 'student@test.com', name: 'Alice', token: 'abc123' };

  it('sends email with correct subject', async () => {
    await sendActivationEmail(data);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'student@test.com',
        subject: 'Activate Your HOPE Platform Account',
        from: 'HOPE Platform <noreply@example.com>',
      }),
    );
  });

  it('includes activation URL with token in html', async () => {
    await sendActivationEmail(data);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('http://localhost:5173/activate?token=abc123');
  });

  it('includes activation URL in text', async () => {
    await sendActivationEmail(data);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.text).toContain('http://localhost:5173/activate?token=abc123');
  });

  it('includes recipient name in body', async () => {
    await sendActivationEmail(data);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Hello Alice');
    expect(call.text).toContain('Hello Alice');
  });

  it('throws when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP down'));
    await expect(sendActivationEmail(data)).rejects.toThrow('Failed to send activation email');
  });
});

// ─── sendPasswordResetEmail ───

describe('sendPasswordResetEmail', () => {
  const data = { to: 'user@test.com', name: 'Bob', token: 'reset-xyz' };

  it('sends email with correct subject', async () => {
    await sendPasswordResetEmail(data);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'Reset Your HOPE Platform Password',
      }),
    );
  });

  it('includes reset URL with token', async () => {
    await sendPasswordResetEmail(data);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('http://localhost:5173/reset-password?token=reset-xyz');
    expect(call.text).toContain('http://localhost:5173/reset-password?token=reset-xyz');
  });

  it('throws when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP down'));
    await expect(sendPasswordResetEmail(data)).rejects.toThrow('Failed to send password reset email');
  });
});

// ─── sendMentorAlert ───

describe('sendMentorAlert', () => {
  const baseData = {
    to: 'mentor@test.com',
    mentorName: 'Dr. Smith',
    studentName: 'Charlie',
    riskLevel: 'HIGH',
    riskScore: 75.5,
  };

  it('sends alert with student name and risk level in subject', async () => {
    await sendMentorAlert(baseData);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Risk Alert: Charlie - HIGH Risk',
      }),
    );
  });

  it('includes risk score in body', async () => {
    await sendMentorAlert(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('75.50');
    expect(call.text).toContain('75.50');
  });

  it('includes factors when provided', async () => {
    await sendMentorAlert({ ...baseData, factors: { attendance: 'Low' } });
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Contributing Factors');
    expect(call.text).toContain('- attendance: Low');
  });

  it('includes intervention link when provided', async () => {
    await sendMentorAlert({ ...baseData, interventionLink: 'http://app/intervene/1' });
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('http://app/intervene/1');
    expect(call.text).toContain('http://app/intervene/1');
  });

  it('omits factors section when not provided', async () => {
    await sendMentorAlert(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('Contributing Factors');
  });

  it('throws when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP down'));
    await expect(sendMentorAlert(baseData)).rejects.toThrow('Failed to send mentor alert email');
  });
});

// ─── sendWeeklyReport ───

describe('sendWeeklyReport', () => {
  const baseData = {
    to: 'mentor@test.com',
    mentorName: 'Dr. Smith',
    weekStart: new Date('2026-09-21'),
    weekEnd: new Date('2026-09-28'),
    students: [
      { name: 'Alice', riskLevel: 'HIGH', riskScore: 80, trend: '↑ Worsening' },
      { name: 'Bob', riskLevel: 'MEDIUM', riskScore: 45, trend: '→ Stable' },
    ],
  };

  it('sends report with date range in subject', async () => {
    await sendWeeklyReport(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Weekly Risk Report');
    expect(call.subject).toContain('Sep');
  });

  it('includes student table rows in html', async () => {
    await sendWeeklyReport(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Alice');
    expect(call.html).toContain('Bob');
    expect(call.html).toContain('80.00');
  });

  it('includes student list in text', async () => {
    await sendWeeklyReport(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.text).toContain('Alice');
    expect(call.text).toContain('Bob');
  });

  it('shows total count when students present', async () => {
    await sendWeeklyReport(baseData);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Total at-risk students');
    expect(call.text).toContain('Total at-risk students: 2');
  });

  it('shows no-risk message when students array is empty', async () => {
    await sendWeeklyReport({ ...baseData, students: [] });
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('No students are currently at high risk');
    expect(call.text).toContain('No students are currently at high risk');
  });

  it('throws when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP down'));
    await expect(sendWeeklyReport(baseData)).rejects.toThrow('Failed to send weekly report email');
  });
});

// ─── closeEmailTransporter ───

describe('closeEmailTransporter', () => {
  it('can be called without error', async () => {
    await expect(closeEmailTransporter()).resolves.toBeUndefined();
  });
});
