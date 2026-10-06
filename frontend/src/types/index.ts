// src/types/index.ts

export type RoleName =
  | 'STUDENT'
  | 'TRAINER'
  | 'FACULTY'
  | 'MENTOR'
  | 'COORDINATOR'
  | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  department?: string;
  year?: number;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  createdAt?: string;
  updatedAt?: string;
}

export interface Batch {
  id: string;
  name: string;
  department?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  memberCount?: number;
  trainerCount?: number;
  members?: User[] | string[];
  trainers?: User[] | string[];
  sessions?: Session[];
}

export interface Session {
  id: string;
  batchId: string;
  trainerId?: string;
  title: string;
  topic?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  room?: string;
  batch?: Batch;
}

export interface AttendanceWindow {
  id: string;
  sessionId: string;
  label: string;
  startTime: string;
  endTime: string;
  qrToken?: string;
}

export interface AttendanceRecord {
  id: string;
  windowId: string;
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  markedAt: string;
  markedBy?: string;
  remarks?: string;
  student?: User;
  session?: Session;
}

export interface AssessmentQuestion {
  id: string;
  sectionId: string;
  label: string;
  maxScore: number;
  sortOrder: number;
}

export interface AssessmentSection {
  id: string;
  assessmentId: string;
  title: string;
  sortOrder: number;
  weightage?: number;
  questions: AssessmentQuestion[];
}

export interface Assessment {
  id: string;
  batchId: string;
  title: string;
  type: 'QUIZ' | 'ASSIGNMENT' | 'CODING_TEST' | 'CONTEST';
  assessmentDate: string;
  maxScore: number;
  sections?: AssessmentSection[];
  batch?: Batch;
  resultCount?: number;
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number;
  remarks?: string;
  student?: User;
}

export interface Feedback {
  id: string;
  sessionId: string;
  studentId: string;
  trainerId: string;
  effortRating: number;
  participationRating: number;
  comments?: string;
  createdAt: string;
  student?: User;
  trainer?: User;
  session?: Session;
}

export interface MentorAssignment {
  id: string;
  mentorId: string;
  studentId: string;
  assignedAt: string;
  mentor?: User;
  student?: User;
}

export interface RiskScore {
  id: string;
  studentId: string;
  attendanceRisk: number;
  assessmentRisk: number;
  feedbackRisk: number;
  totalScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factors?: {
    attendanceRate: number;
    avgAssessmentScore: number;
    negativeFeedbackCount: number;
    decliningTrend?: boolean;
    mlSuggestedEscalation?: boolean;
  };
  generatedAt: string;
  student?: User;
}

export interface MentorAlert {
  id: number;
  mentorId: string;
  studentId: string;
  riskScore: number;
  riskCategory: 'MEDIUM' | 'HIGH';
  suggestedAction: string;
  status: 'pending' | 'seen' | 'acted' | 'dismissed';
  createdAt: string;
  student?: User;
  outcome?: {
    mentorResponse: 'acted' | 'dismissed' | 'ignored';
    responseTimeHours?: number;
    wasRecommendationFollowed: boolean;
    outcomeNotes?: string;
  };
}

export interface Intervention {
  id: string;
  studentId: string;
  mentorId: string;
  riskScoreId?: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  student?: User;
  mentor?: User;
  riskScore?: RiskScore;
  updates: { id: string; note: string; createdAt: string }[];
  outcome?: {
    id: string;
    outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED';
    remarks?: string;
    recordedAt: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  isMandatory: boolean;
  isInternal: boolean;
  maxMarks?: number;
  deadlineType: 'HARD' | 'SOFT' | 'NONE';
  deadline?: string;
  deadlineNote?: string;
  closedAt?: string;
  createdById: string;
  createdBy?: User;
  batchIds: string[];
  submissionCount?: number;
  createdAt: string;
  submissions?: TaskSubmission[];
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  studentId: string;
  progress: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  isInterested: boolean;
  completedAt?: string;
  isLate?: boolean;
  marksAwarded?: number;
  studentNotes?: string;
  student?: User;
  createdAt: string;
}

export interface EventItem {
  id: string;
  title: string;
  description?: string;
  eventType: 'HACKATHON' | 'CONTEST' | 'WORKSHOP' | 'PLACEMENT_DRIVE';
  eventDate: string;
  registrationDeadline?: string;
  _count?: {
    registrations: number;
    proofSubmissions: number;
  };
  registrations?: any[];
  proofSubmissions?: any[];
}

export interface ProofSubmission {
  id: string;
  eventId: string;
  studentId: string;
  fileUrl: string;
  fileName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks?: string;
  createdAt: string;
  student?: User;
  event?: EventItem;
}

export interface LeaderboardRankItem {
  rank: number;
  student: {
    id: string;
    name: string;
    email: string;
    department?: string;
    year?: number;
  };
  attendanceRate: number;
  assessmentAverage: number;
  contestScore: number;
  finalScore: number;
}

export interface LeaderboardResponse {
  batch: {
    id: string;
    name: string;
    department?: string;
  };
  week: string;
  contestDataWarning: string | null;
  leaderboard: LeaderboardRankItem[];
  totalEvaluated: number;
}
