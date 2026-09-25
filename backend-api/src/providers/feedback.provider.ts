import prisma from '../lib/prisma';

export interface FeedbackStats {
  feedbackCount: number;
  negativeFeedbackCount: number;
  hasNegativeFeedback: boolean;
  averageEffortRating: number;
  averageParticipationRating: number;
}

export async function getFeedbackStats(
  studentId: string,
  batchId: string,
): Promise<FeedbackStats | null> {
  const feedbacks = await prisma.feedback.findMany({
    where: {
      studentId,
      session: { batchId },
    },
    select: {
      effortRating: true,
      participationRating: true,
    },
  });

  if (feedbacks.length === 0) return null;

  const negativeFeedbackCount = feedbacks.filter(
    (f) => f.effortRating <= 2 || f.participationRating <= 2,
  ).length;

  const totalEffort = feedbacks.reduce((sum, f) => sum + f.effortRating, 0);
  const totalParticipation = feedbacks.reduce((sum, f) => sum + f.participationRating, 0);

  return {
    feedbackCount: feedbacks.length,
    negativeFeedbackCount,
    hasNegativeFeedback: negativeFeedbackCount > 0,
    averageEffortRating: totalEffort / feedbacks.length,
    averageParticipationRating: totalParticipation / feedbacks.length,
  };
}
