import { getList } from './contracts';
// src/services/interventions.service.ts
import api from './api';
import { Intervention } from '../types';

export interface CreateInterventionPayload {
  alertId: number;
  causeCode: string;
  title: string;
  description: string;
  deadline?: string;
}

export async function getInterventions(): Promise<Intervention[]> {
  return getList('/api/interventions');
}

export async function getIntervention(id: string): Promise<Intervention> {
  const res = await api.get(`/api/interventions/${id}`);
  return res.data.data;
}

export async function createIntervention(payload: CreateInterventionPayload): Promise<Intervention> {
  const res = await api.post('/api/interventions', payload);
  return res.data.data.intervention;
}

export async function updateIntervention(id: string, payload: Partial<Intervention>): Promise<Intervention> {
  const res = await api.patch(`/api/interventions/${id}`, payload);
  return res.data.data;
}

export async function addInterventionUpdate(id: string, note: string): Promise<{ id: string; note: string; createdAt: string }> {
  const res = await api.post(`/api/interventions/${id}/notes`, { note });
  return res.data.data;
}

export async function logInterventionOutcome(id: string, outcome: 'IMPROVED' | 'NO_CHANGE' | 'DECLINED', remarks?: string) {
  const res = await api.post(`/api/interventions/${id}/complete`, { outcome, remarks });
  return res.data.data;
}

export async function getInterventionAlerts(): Promise<any[]> { return (await api.get('/api/interventions/alerts')).data.data; }
