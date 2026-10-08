// src/services/feedback.service.ts
import api from './api';
import { Feedback } from '../types';

export type { Feedback };

export async function getFeedbackList(params?: Record<string, string>): Promise<any> {
  const res = await api.get('/api/feedback', { params });
  return res.data?.data ?? res.data;
}

export async function getFeedback(id: string): Promise<any> {
  const res = await api.get(`/api/feedback/${id}`);
  return res.data?.data ?? res.data;
}

export async function createFeedback(payload: {
  sessionId: string;
  studentId: string;
  effortRating: number;
  participationRating: number;
  comments?: string;
}): Promise<any> {
  const res = await api.post('/api/feedback', payload);
  return res.data?.data ?? res.data;
}

export async function createBulkFeedback(sessionId: string, records: {
  studentId: string;
  effortRating: number;
  participationRating: number;
  comments?: string;
}[]): Promise<any> {
  const res = await api.post('/api/feedback/bulk', { sessionId, records });
  return res.data?.data ?? res.data;
}

export async function updateFeedback(id: string, payload: Partial<{
  effortRating: number;
  participationRating: number;
  comments: string;
}>): Promise<any> {
  const res = await api.put(`/api/feedback/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteFeedback(id: string): Promise<void> {
  await api.delete(`/api/feedback/${id}`);
}
