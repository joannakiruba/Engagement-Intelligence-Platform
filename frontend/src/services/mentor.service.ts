// src/services/mentor.service.ts
import api from './api';
import { MentorAlert, MentorAssignment } from '../types';

export async function getMentorAssignments(params?: { mentorId?: string; studentId?: string }): Promise<MentorAssignment[]> {
  const res = await api.get('/api/mentor-assignments', { params });
  return res.data.data;
}

export async function createMentorAssignment(mentorId: string, studentId: string): Promise<MentorAssignment> {
  const res = await api.post('/api/mentor-assignments', { mentorId, studentId });
  return res.data.data;
}

export async function deleteMentorAssignment(id: string): Promise<void> {
  await api.delete(`/api/mentor-assignments/${id}`);
}

export async function getMentorAlerts(mentorId: string): Promise<MentorAlert[]> {
  const res = await api.get(`/api/mentor-alerts/mentor/${mentorId}`);
  return res.data.data;
}

export async function getStudentAlerts(studentId: string): Promise<MentorAlert[]> {
  const res = await api.get(`/api/mentor-alerts/student/${studentId}`);
  return res.data.data;
}

export async function getAlertStats(): Promise<{ total: number; pending: number; acted: number; dismissed: number }> {
  const res = await api.get('/api/mentor-alerts/stats');
  return res.data.data;
}

export async function updateAlertStatus(alertId: number, status: 'pending' | 'seen' | 'acted' | 'dismissed'): Promise<MentorAlert> {
  const res = await api.put(`/api/mentor-alerts/${alertId}/status`, { status });
  return res.data.data;
}

export async function recordAlertOutcome(alertId: number, data: {
  mentor_response: 'acted' | 'dismissed' | 'ignored';
  response_time_hours?: number;
  was_recommendation_followed: boolean;
  outcome_notes?: string;
}): Promise<MentorAlert> {
  const res = await api.post(`/api/mentor-alerts/${alertId}/outcome`, data);
  return res.data.data;
}
