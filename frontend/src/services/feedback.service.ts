import api from './api';

export interface Feedback {
  id: string;
  sessionId: string;
  studentId: string;
  trainerId: string;
  effortRating: number;
  participationRating: number;
  comments: string | null;
  createdAt: string;
  session?: { id: string; title: string; scheduledDate: string; batchId?: string };
  student?: { id: string; name: string; email: string };
  trainer?: { id: string; name: string; email: string };
}

export interface FeedbackFilters {
  sessionId?: string;
  studentId?: string;
  trainerId?: string;
}

export interface CreateFeedbackPayload {
  sessionId: string;
  studentId: string;
  effortRating: number;
  participationRating: number;
  comments?: string;
}

export interface BulkFeedbackRecord {
  studentId: string;
  effortRating: number;
  participationRating: number;
  comments?: string;
}

export interface BulkFeedbackResult {
  total: number;
  created: number;
  skipped: { studentId: string; reason: string }[];
}

export async function getFeedbackList(filters?: FeedbackFilters): Promise<Feedback[]> {
  const params = new URLSearchParams();
  if (filters?.sessionId) params.set('sessionId', filters.sessionId);
  if (filters?.studentId) params.set('studentId', filters.studentId);
  if (filters?.trainerId) params.set('trainerId', filters.trainerId);
  const res = await api.get(`/api/feedback?${params.toString()}`);
  return res.data.data;
}

export async function getFeedback(id: string): Promise<Feedback> {
  const res = await api.get(`/api/feedback/${id}`);
  return res.data.data;
}

export async function createFeedback(payload: CreateFeedbackPayload): Promise<Feedback> {
  const res = await api.post('/api/feedback', payload);
  return res.data.data;
}

export async function bulkCreateFeedback(sessionId: string, records: BulkFeedbackRecord[]): Promise<BulkFeedbackResult> {
  const res = await api.post('/api/feedback/bulk', { sessionId, records });
  return res.data.data;
}

export async function updateFeedback(id: string, payload: Partial<CreateFeedbackPayload>): Promise<Feedback> {
  const res = await api.put(`/api/feedback/${id}`, payload);
  return res.data.data;
}

export async function deleteFeedback(id: string): Promise<void> {
  await api.delete(`/api/feedback/${id}`);
}
