// src/services/engagement.service.ts
import api from './api';

export async function getEngagementDashboard() {
  const res = await api.get('/api/engagement/dashboard');
  return res.data.data;
}

export async function getBatchEngagement(batchId: string) {
  const res = await api.get(`/api/engagement/batch/${batchId}`);
  return res.data.data;
}

export async function getBatchTrends(batchId: string) {
  const res = await api.get(`/api/engagement/batch/${batchId}/trends`);
  return res.data.data;
}

export async function getStudentEngagement(studentId: string) {
  const res = await api.get(`/api/engagement/student/${studentId}`);
  return res.data.data;
}
