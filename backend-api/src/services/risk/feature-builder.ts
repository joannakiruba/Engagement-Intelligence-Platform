import { getAttendanceStats, AttendanceStats } from '../../providers/attendance.provider';
import { getAssessmentStats, AssessmentStats } from '../../providers/assessment.provider';
import { getFeedbackStats, FeedbackStats } from '../../providers/feedback.provider';

export interface DataAvailability {
  attendance: boolean;
  assessment: boolean;
  feedback: boolean;
}

export interface StudentFeatures {
  studentId: string;
  batchId: string;
  attendance: AttendanceStats | null;
  assessment: AssessmentStats | null;
  feedback: FeedbackStats | null;
  dataAvailability: DataAvailability;
}

export async function buildFeatures(
  studentId: string,
  batchId: string,
): Promise<StudentFeatures> {
  const [attendance, assessment, feedback] = await Promise.all([
    getAttendanceStats(studentId, batchId),
    getAssessmentStats(studentId, batchId),
    getFeedbackStats(studentId, batchId),
  ]);

  return {
    studentId,
    batchId,
    attendance,
    assessment,
    feedback,
    dataAvailability: {
      attendance: attendance !== null,
      assessment: assessment !== null,
      feedback: feedback !== null,
    },
  };
}
