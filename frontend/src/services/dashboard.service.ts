import api from "./api";

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
  batch: {
    id: string;
    name: string;
  };
  attendance: AttendanceTrend[];
  assessments: AssessmentTrend[];
  feedback: FeedbackTrend[];
}

// --- Engagement Dashboard API ---

export async function getEngagementDashboard(
  filters?: DateFilters
): Promise<DashboardData> {
  const params: Record<string, string> = {};

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  const res = await api.get("/api/engagement/dashboard", {
    params,
  });

  return res.data.data;
}

// --- Batch Engagement API ---

export async function getBatchEngagement(
  batchId: string,
  filters?: DateFilters
): Promise<BatchEngagementData> {
  const params: Record<string, string> = {};

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  const res = await api.get(
    `/api/engagement/batch/${batchId}`,
    { params }
  );

  return res.data.data;
}

// --- Student Engagement API ---

export async function getStudentEngagement(
  studentId: string,
  filters?: StudentFilters
): Promise<StudentEngagementData> {
  const params: Record<string, string> = {};

  if (filters?.batchId) {
    params.batchId = filters.batchId;
  }

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  const res = await api.get(
    `/api/engagement/student/${studentId}`,
    { params }
  );

  return res.data.data;
}

// --- Batch Trends API ---

export async function getBatchTrends(
  batchId: string,
  filters?: DateFilters
): Promise<BatchTrendsData> {
  const params: Record<string, string> = {};

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  const res = await api.get(
    `/api/engagement/batch/${batchId}/trends`,
    { params }
  );

  return res.data.data;
}

// --- Events ---

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  eventDate: string;
  registrationDeadline: string | null;
  createdAt: string;
  _count?: {
    registrations: number;
    proofSubmissions: number;
  };
}

export async function getEvents(): Promise<EventItem[]> {
  const res = await api.get("/api/events");

  return res.data.data;
}

export async function getEvent(id: string): Promise<EventItem> {
  const res = await api.get(`/api/events/${id}`);

  return res.data.data;
}

// --- Proof Submissions ---

export interface ProofSubmission {
  id: string;
  eventId: string;
  studentId: string;
  fileUrl: string;
  fileName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  remarks: string | null;
  createdAt: string;
  event?: {
    id: string;
    title: string;
    eventType: string;
    eventDate?: string;
  };
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

export async function getMyProofs(): Promise<ProofSubmission[]> {
  const res = await api.get("/api/proofs/my");

  return res.data.data;
}

export async function getAllProofs(
  filters?: {
    eventId?: string;
    studentId?: string;
    status?: string;
  }
): Promise<ProofSubmission[]> {
  const params = new URLSearchParams();

  if (filters?.eventId) {
    params.set("eventId", filters.eventId);
  }

  if (filters?.studentId) {
    params.set("studentId", filters.studentId);
  }

  if (filters?.status) {
    params.set("status", filters.status);
  }

  const query = params.toString();

  const res = await api.get(
    query ? `/api/proofs?${query}` : "/api/proofs"
  );

  return res.data.data;
}

export async function getProofDetail(
  id: string
): Promise<ProofSubmission> {
  const res = await api.get(`/api/proofs/${id}`);

  return res.data.data;
}

export async function submitProof(
  eventId: string,
  file: File
): Promise<ProofSubmission> {
  const formData = new FormData();

  formData.append("eventId", eventId);
  formData.append("file", file);

  const res = await api.post(
    "/api/proofs",
    formData
  );

  return res.data.data;
}

export async function replaceProofFile(
  proofId: string,
  file: File
): Promise<ProofSubmission> {
  const formData = new FormData();

  formData.append("file", file);

  const res = await api.put(
    `/api/proofs/${proofId}/file`,
    formData
  );

  return res.data.data;
}

export async function reviewProof(
  proofId: string,
  status: "APPROVED" | "REJECTED",
  remarks?: string
): Promise<ProofSubmission> {
  const res = await api.patch(
    `/api/proofs/${proofId}/review`,
    {
      status,
      remarks,
    }
  );

  return res.data.data;
}