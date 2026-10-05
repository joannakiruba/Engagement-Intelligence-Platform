import api from './api';

export interface Intervention {
  id: string;
  studentId: string;
  mentorId: string;
  riskScoreId: string | null;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: string; name: string; email: string };
  mentor?: { id: string; name: string; email: string };
  riskScore?: { id: string; totalScore: number; riskLevel: string } | null;
  updates?: { id: string; note: string; createdAt: string }[];
  outcome?: { id: string; outcome: string; remarks: string | null; recordedAt: string } | null;
}

export interface CreateInterventionPayload {
  studentId: string;
  riskScoreId?: string;
  title: string;
  description: string;
  deadline?: string;
}

export async function getInterventions(params?: { studentId?: string; status?: string }) {
  const res = await api.get('/api/interventions', { params });
  return res.data.data;
}

export async function getIntervention(id: string) {
  const res = await api.get(`/api/interventions/${id}`);
  return res.data.data;
}

export async function createIntervention(payload: CreateInterventionPayload) {
  const res = await api.post('/api/interventions', payload);
  return res.data.data;
}

export async function updateIntervention(id: string, payload: Partial<CreateInterventionPayload> & { status?: string }) {
  const res = await api.put(`/api/interventions/${id}`, payload);
  return res.data.data;
}

export async function addInterventionNote(id: string, note: string) {
  const res = await api.post(`/api/interventions/${id}/updates`, { note });
  return res.data.data;
}

export async function logInterventionOutcome(id: string, data: { outcome: string; remarks?: string }) {
  const res = await api.post(`/api/interventions/${id}/outcome`, data);
  return res.data.data;
}
