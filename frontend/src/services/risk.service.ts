// src/services/risk.service.ts
import api from './api';
import { RiskScore } from '../types';

export async function getHighRiskStudents(): Promise<RiskScore[]> {
  const res = await api.get('/api/risk/high');
  return res.data.data;
}

export async function getStudentRisk(studentId: string): Promise<RiskScore> {
  const res = await api.get(`/api/risk/student/${studentId}`);
  return res.data.data;
}

export async function getStudentRiskHistory(studentId: string): Promise<RiskScore[]> {
  const res = await api.get(`/api/risk/student/${studentId}/history`);
  return res.data.data;
}

export async function calculateStudentRisk(studentId: string): Promise<RiskScore> {
  const res = await api.post(`/api/risk/calculate/${studentId}`);
  return res.data.data;
}
