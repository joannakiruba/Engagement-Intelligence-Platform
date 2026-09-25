import prisma from '../lib/prisma';

export interface AssessmentStats {
  assessmentCount: number;
  averageScorePercentage: number;
}

export async function getAssessmentStats(
  studentId: string,
  batchId: string,
): Promise<AssessmentStats | null> {
  const results = await prisma.assessmentResult.findMany({
    where: {
      studentId,
      assessment: { batchId },
    },
    include: {
      assessment: { select: { maxScore: true } },
    },
  });

  const usable = results.filter((r) => r.assessment.maxScore > 0);

  if (usable.length === 0) return null;

  const totalPercentage = usable.reduce(
    (sum, r) => sum + (r.score / r.assessment.maxScore) * 100,
    0,
  );

  return {
    assessmentCount: usable.length,
    averageScorePercentage: totalPercentage / usable.length,
  };
}
