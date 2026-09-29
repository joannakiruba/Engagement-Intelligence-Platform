import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

let transporter: Transporter | null = null;

function createTransporter(): Transporter {
  if (!config.email.smtpHost || !config.email.smtpUser || !config.email.smtpPass) {
    logger.warn('Email configuration incomplete. Using dummy transporter.');
    return nodemailer.createTransport({
      streamTransport: true,
      newline: 'unix',
    });
  }

  return nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpSecure,
    auth: {
      user: config.email.smtpUser,
      pass: config.email.smtpPass,
    },
  });
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

interface ActivationEmailData {
  to: string;
  name: string;
  token: string;
}

export async function sendActivationEmail(data: ActivationEmailData): Promise<void> {
  const { to, name, token } = data;
  const activationUrl = `${config.frontendUrl}/activate?token=${token}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Activate Your Account</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
    <h2 style="color: #2c3e50; margin-top: 0;">Welcome to HOPE Platform!</h2>
    <p>Hello ${name},</p>
    <p>Your account has been created. Please activate your account by setting a password.</p>
    <p style="margin: 30px 0;">
      <a href="${activationUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Activate Account</a>
    </p>
    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">HOPE Engagement Intelligence Platform</p>
  </div>
</body>
</html>`;

  const textContent = `Welcome to HOPE Platform!

Hello ${name},

Your account has been created. Please activate your account by setting a password.

Activation link: ${activationUrl}

This link will expire in 24 hours.

---
HOPE Engagement Intelligence Platform`;

  try {
    await getTransporter().sendMail({
      from: config.email.emailFrom,
      to,
      subject: 'Activate Your HOPE Platform Account',
      text: textContent.trim(),
      html: htmlContent,
    });
    logger.info('Activation email sent', { to });
  } catch (error) {
    logger.error('Failed to send activation email', { to, error: (error as Error).message });
    throw new Error('Failed to send activation email');
  }
}

interface PasswordResetEmailData {
  to: string;
  name: string;
  token: string;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  const { to, name, token } = data;
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Your Password</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
    <h2 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password.</p>
    <p style="margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
    </p>
    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">HOPE Engagement Intelligence Platform</p>
  </div>
</body>
</html>`;

  const textContent = `Password Reset Request

Hello ${name},

We received a request to reset your password.

Reset link: ${resetUrl}

This link will expire in 1 hour.

---
HOPE Engagement Intelligence Platform`;

  try {
    await getTransporter().sendMail({
      from: config.email.emailFrom,
      to,
      subject: 'Reset Your HOPE Platform Password',
      text: textContent.trim(),
      html: htmlContent,
    });
    logger.info('Password reset email sent', { to });
  } catch (error) {
    logger.error('Failed to send password reset email', { to, error: (error as Error).message });
    throw new Error('Failed to send password reset email');
  }
}

interface MentorAlertEmailData {
  to: string;
  mentorName: string;
  studentName: string;
  riskLevel: string;
  riskScore: number;
  factors?: Record<string, unknown>;
  interventionLink?: string;
}

export async function sendMentorAlert(data: MentorAlertEmailData): Promise<void> {
  const { to, mentorName, studentName, riskLevel, riskScore, factors, interventionLink } = data;
  const factorsText = factors ? Object.entries(factors).map(([k, v]) => `- ${k}: ${v}`).join('\n') : 'No specific factors provided.';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Student Risk Alert</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; border-radius: 5px;">
    <h2 style="color: #856404; margin-top: 0;">Student Risk Alert</h2>
    <p>Hello ${mentorName},</p>
    <p>This is an automated alert regarding one of your assigned students.</p>
    <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Student:</strong> ${studentName}</p>
      <p style="margin: 5px 0;"><strong>Risk Level:</strong> <span style="color: ${riskLevel === 'HIGH' ? '#dc3545' : '#ffc107'}; font-weight: bold;">${riskLevel}</span></p>
      <p style="margin: 5px 0;"><strong>Risk Score:</strong> ${riskScore.toFixed(2)}</p>
    </div>
    ${factors ? `<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0;"><p style="margin-top: 0;"><strong>Contributing Factors:</strong></p><pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${factorsText}</pre></div>` : ''}
    ${interventionLink ? `<p style="margin: 30px 0;"><a href="${interventionLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Create Intervention</a></p>` : ''}
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">HOPE Engagement Intelligence Platform - Automated Alert</p>
  </div>
</body>
</html>`;

  const textContent = `Student Risk Alert

Hello ${mentorName},

Student: ${studentName}
Risk Level: ${riskLevel}
Risk Score: ${riskScore.toFixed(2)}

Contributing Factors:
${factorsText}

${interventionLink ? `Intervention link: ${interventionLink}` : ''}

---
HOPE Engagement Intelligence Platform`;

  try {
    await getTransporter().sendMail({
      from: config.email.emailFrom,
      to,
      subject: `Risk Alert: ${studentName} - ${riskLevel} Risk`,
      text: textContent.trim(),
      html: htmlContent,
    });
    logger.info('Mentor alert email sent', { to, studentName, riskLevel });
  } catch (error) {
    logger.error('Failed to send mentor alert email', { to, error: (error as Error).message });
    throw new Error('Failed to send mentor alert email');
  }
}

interface WeeklyReportStudent {
  name: string;
  riskLevel: string;
  riskScore: number;
  trend?: string;
}

interface WeeklyReportEmailData {
  to: string;
  mentorName: string;
  weekStart: Date;
  weekEnd: Date;
  students: WeeklyReportStudent[];
}

export async function sendWeeklyReport(data: WeeklyReportEmailData): Promise<void> {
  const { to, mentorName, weekStart, weekEnd, students } = data;
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const studentsHtml = students.map(s => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${s.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center; color: ${s.riskLevel === 'HIGH' ? '#dc3545' : s.riskLevel === 'MEDIUM' ? '#ffc107' : '#28a745'}; font-weight: bold;">${s.riskLevel}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${s.riskScore.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${s.trend || 'N/A'}</td>
    </tr>`).join('');

  const studentsText = students.map(s => `- ${s.name}: ${s.riskLevel} (${s.riskScore.toFixed(2)}) - ${s.trend || 'N/A'}`).join('\n');

  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Weekly Student Risk Report</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
    <h2 style="color: #2c3e50; margin-top: 0;">Weekly Student Risk Report</h2>
    <p>Hello ${mentorName},</p>
    <p>Here is your weekly report of at-risk students for the period:</p>
    <p><strong>${formatDate(weekStart)} - ${formatDate(weekEnd)}</strong></p>
    ${students.length > 0 ? `
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: white;">
      <thead>
        <tr style="background-color: #e9ecef;">
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Student</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Risk Level</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Score</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Trend</th>
        </tr>
      </thead>
      <tbody>${studentsHtml}</tbody>
    </table>
    <p>Total at-risk students: <strong>${students.length}</strong></p>` : `<p style="color: #28a745; font-weight: bold;">Great news! No students are currently at high risk.</p>`}
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    <p style="color: #999; font-size: 12px;">HOPE Engagement Intelligence Platform - Weekly Report</p>
  </div>
</body>
</html>`;

  const textContent = `Weekly Student Risk Report

Hello ${mentorName},

Period: ${formatDate(weekStart)} - ${formatDate(weekEnd)}

${students.length > 0 ? `At-Risk Students:\n${studentsText}\n\nTotal at-risk students: ${students.length}` : 'Great news! No students are currently at high risk.'}

---
HOPE Engagement Intelligence Platform`;

  try {
    await getTransporter().sendMail({
      from: config.email.emailFrom,
      to,
      subject: `Weekly Risk Report: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`,
      text: textContent.trim(),
      html: htmlContent,
    });
    logger.info('Weekly report email sent', { to, studentCount: students.length });
  } catch (error) {
    logger.error('Failed to send weekly report email', { to, error: (error as Error).message });
    throw new Error('Failed to send weekly report email');
  }
}

export async function closeEmailTransporter(): Promise<void> {
  if (transporter) {
    transporter.close();
    transporter = null;
    logger.info('Email transporter closed');
  }
}
