import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { buildFeatures } from './feature-builder';
import { calculateRisk } from './rule-engine';
import { makeHybridDecision, MlResult } from './hybrid-decision';
import { getMlPrediction } from '../ml.service';

class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export { ServiceError };

export async function calculateStudentRisk(studentId: string, batchId: string) {
  const start = Date.now();

  const membership = await prisma.batchMember.findUnique({
    where: { batchId_studentId: { batchId, studentId } },
  });

  if (!membership) {
    throw new ServiceError('Student is not a member of the specified batch', 404);
  }

  const features = await buildFeatures(studentId, batchId);
  const ruleResult = calculateRisk(features);
  const mlResult = await getMlPrediction(features);
  const hybrid = makeHybridDecision(ruleResult.riskLevel, mlResult);

  const factors = {
    dataAvailability: features.dataAvailability,
    scope: { batchId },
    ruleBased: {
      attendanceRisk: ruleResult.attendanceRisk,
      assessmentRisk: ruleResult.assessmentRisk,
      feedbackRisk: ruleResult.feedbackRisk,
      totalScore: ruleResult.totalScore,
      riskLevel: ruleResult.riskLevel,
      details: ruleResult.details,
    },
    ml: JSON.parse(JSON.stringify(hybrid.ml)),
    final: {
      riskLevel: hybrid.riskLevel,
      decidedBy: hybrid.decidedBy,
    },
  };

  const riskScore = await prisma.riskScore.create({
    data: {
      studentId,
      attendanceRisk: ruleResult.attendanceRisk,
      assessmentRisk: ruleResult.assessmentRisk,
      feedbackRisk: ruleResult.feedbackRisk,
      totalScore: ruleResult.totalScore,
      riskLevel: hybrid.riskLevel,
      factors: JSON.parse(JSON.stringify(factors)),
    },
  });

  const duration = Date.now() - start;
  logger.info('Risk calculated', {
    event: 'risk.calculated',
    studentId,
    batchId,
    duration,
    ruleScore: ruleResult.totalScore,
    ruleLevel: ruleResult.riskLevel,
    mlStatus: mlResult.status,
    mlFallbackReason: null,
    finalLevel: hybrid.riskLevel,
    decidedBy: hybrid.decidedBy,
  });

  return riskScore;
}

export async function calculateBatchRisk(batchId: string) {
  const start = Date.now();

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new ServiceError('Batch not found', 404);
  }

  const members = await prisma.batchMember.findMany({
    where: { batchId },
    select: { studentId: true },
  });

  const results: { studentId: string; riskScore: any }[] = [];
  const errors: { studentId: string; error: string }[] = [];

  for (const member of members) {
    try {
      const riskScore = await calculateStudentRisk(member.studentId, batchId);
      results.push({ studentId: member.studentId, riskScore });
    } catch (err: any) {
      errors.push({
        studentId: member.studentId,
        error: err.message || 'Unexpected error during risk calculation',
      });
    }
  }

  const duration = Date.now() - start;
  logger.info('Batch risk calculation complete', {
    event: 'risk.batch_complete',
    batchId,
    processed: members.length,
    succeeded: results.length,
    failed: errors.length,
    duration,
  });

  return {
    batchId,
    processed: members.length,
    succeeded: results.length,
    failed: errors.length,
    results,
    errors,
  };
}

export async function getLatestRiskScore(studentId: string) {
  return prisma.riskScore.findFirst({
    where: { studentId },
    orderBy: { generatedAt: 'desc' },
  });
}

export async function getRiskHistory(studentId: string) {
  return prisma.riskScore.findMany({
    where: { studentId },
    orderBy: { generatedAt: 'desc' },
  });
}

export async function getHighRiskStudents() {
  return prisma.riskScore.findMany({
    where: { riskLevel: 'HIGH' },
    distinct: ['studentId'],
    orderBy: { generatedAt: 'desc' },
  });
}
