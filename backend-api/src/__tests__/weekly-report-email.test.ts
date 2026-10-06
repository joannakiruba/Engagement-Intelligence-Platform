/**
 * Email capture tests for weekly report emails.
 *
 * Tests escapeHtml directly, and verifies the email template renders
 * escaped HTML for dynamic content while preserving raw text in the
 * plain-text version.
 */

// The sendWeeklyReport integration tests require module mocking to intercept
// the transporter. Because the email.service module caches the transporter
// as a singleton, we capture emails by mocking nodemailer.createTransport
// BEFORE requiring the module. We use separate describe blocks that each
// reset modules for isolation.

import { escapeHtml } from '../services/email.service';

// ---------------------------------------------------------------------------
// escapeHtml unit tests
// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
  test('escapes ampersand', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('escapes angle brackets', () => {
    expect(escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  test('escapes double and single quotes', () => {
    expect(escapeHtml('"hello" & \'world\'')).toBe('&quot;hello&quot; &amp; &#39;world&#39;');
  });

  test('escapes XSS img payload — angle brackets become entities', () => {
    const input = '<img src=x onerror=alert(1)>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
    expect(result).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('escapes script tags', () => {
    const input = '<script>alert("xss")</script>';
    const result = escapeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  test('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('returns safe string unchanged', () => {
    expect(escapeHtml('Alice Student')).toBe('Alice Student');
  });
});

// ---------------------------------------------------------------------------
// Email rendering integration tests — capture via mock transport
// ---------------------------------------------------------------------------

// We mock nodemailer at the top level so the singleton picks up our mock
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: (...args: any[]) => mockSendMail(...args),
    close: jest.fn(),
  }),
}));

jest.mock('../config', () => ({
  config: {
    email: {
      smtpHost: undefined,
      smtpUser: undefined,
      smtpPass: undefined,
      smtpPort: 587,
      smtpSecure: false,
      emailFrom: 'HOPE Platform <noreply@test.local>',
    },
    isProduction: false,
    frontendUrl: 'http://localhost:5173',
    redis: { host: 'localhost', port: 6379, db: 0 },
    jwt: { secret: 'test', accessExpiry: '15m', refreshExpiryDays: 7, refreshAbsoluteCeilingDays: 30, refreshGraceWindowSeconds: 10 },
    weeklyReport: { enabled: true, dayOfWeek: 1, hour: 9, timezone: 'Asia/Kolkata' },
  },
}));

jest.mock('../jobs/queue', () => ({
  __esModule: true,
  queueWeeklyReport: jest.fn(),
  weeklyReportQueue: { add: jest.fn() },
}));

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {},
}));

// Import AFTER all mocks are set up
const { sendWeeklyReport: sendReport } = require('../services/email.service');

function lastHtml(): string {
  const call = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1];
  return call?.[0]?.html || '';
}

function lastText(): string {
  const call = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1];
  return call?.[0]?.text || '';
}

describe('Weekly report email rendering', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
  });

  const baseData = {
    to: 'mentor@test.local',
    mentorName: 'Dr. Test Mentor',
    weekStart: new Date('2026-09-28T00:00:00.000Z'),
    weekEnd: new Date('2026-10-05T00:00:00.000Z'),
    students: [
      {
        name: 'Alice Student',
        riskLevel: 'HIGH',
        riskScore: 65.0,
        trend: '↑ Worsening',
        reasons: ['Low attendance: 62.5%', 'Low assessment score: 38.0%'],
        dataAvailability: { attendance: true, assessment: true, feedback: true },
      },
      {
        name: 'Bob Student',
        riskLevel: 'MEDIUM',
        riskScore: 35.0,
        trend: '→ Stable',
        reasons: ['Low attendance: 72.0%'],
        dataAvailability: { attendance: true, assessment: false, feedback: true },
      },
    ],
  };

  test('basic email sends without error', async () => {
    await sendReport(baseData);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test('HTML contains student names, risk levels, and scores', async () => {
    await sendReport(baseData);
    const html = lastHtml();
    expect(html).toContain('Alice Student');
    expect(html).toContain('Bob Student');
    expect(html).toContain('HIGH');
    expect(html).toContain('MEDIUM');
    expect(html).toContain('65.00');
    expect(html).toContain('35.00');
  });

  test('trend arrows appear in HTML', async () => {
    await sendReport(baseData);
    const html = lastHtml();
    expect(html).toContain('↑ Worsening');
    expect(html).toContain('→ Stable');
  });

  test('missing data warning appears for Bob (assessment: false)', async () => {
    await sendReport(baseData);
    const html = lastHtml();
    expect(html).toContain('Missing: assessment');
  });

  test('empty students list shows positive message', async () => {
    await sendReport({ ...baseData, students: [] });
    const html = lastHtml();
    const text = lastText();
    expect(html).toContain('No students are currently at high risk');
    expect(text).toContain('No students are currently at high risk');
  });

  test('XSS in student name: <img src=x onerror=alert(1)> is escaped in HTML', async () => {
    const xssName = '<img src=x onerror=alert(1)>';
    await sendReport({
      ...baseData,
      students: [{
        name: xssName,
        riskLevel: 'HIGH',
        riskScore: 70.0,
        trend: 'N/A',
        reasons: ['Test reason'],
        dataAvailability: null,
      }],
    });
    const html = lastHtml();
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('HTML entities in mentor name are escaped', async () => {
    await sendReport({
      ...baseData,
      mentorName: 'Dr. O\'Brien & Associates',
    });
    const html = lastHtml();
    expect(html).toContain('O&#39;Brien &amp; Associates');
  });

  test('HTML in reasons is escaped', async () => {
    await sendReport({
      ...baseData,
      students: [{
        name: 'Test',
        riskLevel: 'HIGH',
        riskScore: 50.0,
        trend: 'N/A',
        reasons: ['Reason with <b>HTML</b> & "quotes"'],
        dataAvailability: null,
      }],
    });
    const html = lastHtml();
    expect(html).toContain('&lt;b&gt;HTML&lt;/b&gt;');
    expect(html).toContain('&amp; &quot;quotes&quot;');
  });

  test('plain text preserves raw characters (no HTML escaping)', async () => {
    const xssName = '<img src=x onerror=alert(1)>';
    await sendReport({
      ...baseData,
      mentorName: 'Dr. O\'Brien & Associates',
      students: [{
        name: xssName,
        riskLevel: 'HIGH',
        riskScore: 70.0,
        trend: 'N/A',
        reasons: ['Reason with <b>HTML</b>'],
        dataAvailability: null,
      }],
    });
    const text = lastText();
    expect(text).toContain(xssName);
    expect(text).toContain("O'Brien & Associates");
    expect(text).toContain('<b>HTML</b>');
  });
});
