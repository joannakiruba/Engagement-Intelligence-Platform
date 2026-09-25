import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import prisma from '../utils/prisma';
import { sendWeeklyReport } from '../services/email.service';
import type { WeeklyReportJob } from './queue';

const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null,
});

export const weeklyReportWorker = new Worker<WeeklyReportJob>(
  'weekly-report',
  async (job: Job<WeeklyReportJob>) => {
    const { mentorId, weekStart, weekEnd } = job.data;

    logger.info('Processing weekly report job', {
      jobId: job.id,
      mentorId,
      weekStart,
      weekEnd
    });

    try {
      // Fetch mentor details
      const mentor = await prisma.user.findUnique({
        where: { id: mentorId },
        select: { id: true, name: true, email: true }
      });

      if (!mentor) {
        logger.warn('Mentor not found for weekly report', { mentorId });
        return { success: false, reason: 'Mentor not found' };
      }

      // Find all students assigned to this mentor
      const mentorAssignments = await prisma.mentorAssignment.findMany({
        where: { mentorId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      const studentIds = mentorAssignments.map(ma => ma.studentId);

      if (studentIds.length === 0) {
        logger.info('No students assigned to mentor', { mentorId });
        await sendWeeklyReport({
          to: mentor.email,
          mentorName: mentor.name,
          weekStart: new Date(weekStart),
          weekEnd: new Date(weekEnd),
          students: []
        });
        return { success: true, studentCount: 0 };
      }

      // Find latest risk scores for assigned students within the date range
      const riskScores = await prisma.riskScore.findMany({
        where: {
          studentId: { in: studentIds },
          generatedAt: {
            gte: new Date(weekStart),
            lte: new Date(weekEnd)
          },
          riskLevel: { in: ['MEDIUM', 'HIGH'] }
        },
        include: {
          student: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      // Group by student and take the most recent score
      const latestScoresByStudent = new Map<string, typeof riskScores[0]>();
      for (const score of riskScores) {
        if (!latestScoresByStudent.has(score.studentId)) {
          latestScoresByStudent.set(score.studentId, score);
        }
      }

      // Calculate trend by comparing with previous week's scores
      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      const previousWeekEnd = new Date(weekStart);

      const previousScores = await prisma.riskScore.findMany({
        where: {
          studentId: { in: studentIds },
          generatedAt: {
            gte: previousWeekStart,
            lte: previousWeekEnd
          }
        },
        orderBy: {
          generatedAt: 'desc'
        }
      });

      const previousScoresByStudent = new Map<string, number>();
      for (const score of previousScores) {
        if (!previousScoresByStudent.has(score.studentId)) {
          previousScoresByStudent.set(score.studentId, score.totalScore);
        }
      }

      // Prepare student data for email
      const atRiskStudents = Array.from(latestScoresByStudent.values()).map(score => {
        const previousScore = previousScoresByStudent.get(score.studentId);
        let trend = 'N/A';

        if (previousScore !== undefined) {
          const difference = score.totalScore - previousScore;
          if (difference > 5) {
            trend = '↑ Worsening';
          } else if (difference < -5) {
            trend = '↓ Improving';
          } else {
            trend = '→ Stable';
          }
        }

        return {
          name: score.student.name,
          riskLevel: score.riskLevel,
          riskScore: score.totalScore,
          trend
        };
      });

      // Sort by risk score descending
      atRiskStudents.sort((a, b) => b.riskScore - a.riskScore);

      await sendWeeklyReport({
        to: mentor.email,
        mentorName: mentor.name,
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        students: atRiskStudents
      });

      logger.info('Weekly report processed successfully', {
        jobId: job.id,
        mentorId,
        studentCount: atRiskStudents.length
      });

      return {
        success: true,
        studentCount: atRiskStudents.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to process weekly report', {
        jobId: job.id,
        mentorId,
        error: (error as Error).message
      });
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

weeklyReportWorker.on('completed', (job) => {
  logger.info('Weekly report job completed', { jobId: job.id });
});

weeklyReportWorker.on('failed', (job, error) => {
  logger.error('Weekly report job failed', {
    jobId: job?.id,
    error: error.message,
    attempts: job?.attemptsMade
  });
});

weeklyReportWorker.on('error', (error) => {
  logger.error('Weekly report worker error', { error: error.message });
});

logger.info('Weekly report worker started');
