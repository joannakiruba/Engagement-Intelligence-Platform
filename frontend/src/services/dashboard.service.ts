import api from './api';

// --- Filter Types ---

export interface DateFilters {
  from?: string;
  to?: string;
}

export interface StudentFilters extends DateFilters {
  batchId?: string;
}

// --- Dashboard Response ---

export interface BatchSummary {
  batchId: string;
  batchName: string;
  studentCount: number;
  attendanceRate: number;
  averageAssessmentScore: number;
  averageEffortRating: number;
  averageParticipationRating: number;
}

export interface DashboardData {
  totalStudents: number;
  totalBatches: number;
  totalSessions: number;
  averageAttendanceRate: number;
  averageAssessmentScore: number;
  averageEffortRating: number;
  averageParticipationRating: number;
  batches: BatchSummary[];
}

// --- Batch Engagement Response ---

export interface AttendanceSummary {
  averageRate: number;
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
}

export interface AssessmentSummary {
  averageScore: number;
  averagePercentage: number;
  totalResults: number;
}

export interface FeedbackSummary {
  averageEffortRating: number;
  averageParticipationRating: number;
  totalFeedbackCount: number;
}

export interface StudentEngagementRow {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attendanceRate: number;
  assessmentAverage: number;
  effortRating: number;
  participationRating: number;
}

export interface BatchEngagementData {
  batch: {
    id: string;
    name: string;
    department: string | null;
    startDate: string;
  };
  studentCount: number;
  sessionCount: number;
  assessmentCount: number;
  attendance: AttendanceSummary;
  assessments: AssessmentSummary;
  feedback: FeedbackSummary;
  students: StudentEngagementRow[];
}

// --- Student Engagement Response ---

export interface StudentAttendanceData {
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  attendanceRate: number;
}

export interface AssessmentResult {
  assessmentId: string;
  title: string;
  type: string;
  score: number;
  maxScore: number;
  percentage: number;
  assessmentDate: string;
}

export interface RecentFeedback {
  sessionId: string;
  sessionTitle: string;
  effortRating: number;
  participationRating: number;
  comments: string | null;
  createdAt: string;
}

export interface StudentEngagementData {
  student: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    year: number | null;
  };
  attendance: StudentAttendanceData;
  assessments: {
    totalAssessments: number;
    averageScore: number;
    averagePercentage: number;
    results: AssessmentResult[];
  };
  feedback: {
    totalFeedback: number;
    averageEffortRating: number;
    averageParticipationRating: number;
    recentFeedback: RecentFeedback[];
  };
}

// --- Batch Trends Response ---

export interface AttendanceTrend {
  sessionId: string;
  sessionTitle: string;
  scheduledDate: string;
  presentCount: number;
  totalCount: number;
  attendanceRate: number;
}

export interface AssessmentTrend {
  assessmentId: string;
  title: string;
  type: string;
  assessmentDate: string;
  averageScore: number;
  maxScore: number;
  averagePercentage: number;
  resultCount: number;
}

export interface FeedbackTrend {
  sessionId: string;
  sessionTitle: string;
  scheduledDate: string;
  averageEffortRating: number;
  averageParticipationRating: number;
  feedbackCount: number;
}

export interface BatchTrendsData {
  batch: { id: string; name: string };
  attendance: AttendanceTrend[];
  assessments: AssessmentTrend[];
  feedback: FeedbackTrend[];
}

// --- API Functions ---

export async function getEngagementDashboard(filters?: DateFilters): Promise<DashboardData> {
  const params: Record<string, string> = {};
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  const res = await api.get('/api/engagement/dashboard', { params });
  return res.data.data;
}

export async function getBatchEngagement(batchId: string, filters?: DateFilters): Promise<BatchEngagementData> {
  const params: Record<string, string> = {};
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  const res = await api.get(`/api/engagement/batch/${batchId}`, { params });
  return res.data.data;
}

export async function getStudentEngagement(studentId: string, filters?: StudentFilters): Promise<StudentEngagementData> {
  const params: Record<string, string> = {};
  if (filters?.batchId) params.batchId = filters.batchId;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  const res = await api.get(`/api/engagement/student/${studentId}`, { params });
  return res.data.data;
}

export async function getBatchTrends(batchId: string, filters?: DateFilters): Promise<BatchTrendsData> {
  const params: Record<string, string> = {};
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  const res = await api.get(`/api/engagement/batch/${batchId}/trends`, { params });
  return res.data.data;
}
