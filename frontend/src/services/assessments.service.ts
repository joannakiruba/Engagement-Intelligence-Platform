// src/services/assessments.service.ts
import api from './api';
import { Assessment, AssessmentResult, AssessmentSection } from '../types';

export interface SectionInput {
  title: string;
  weightage?: number;
  sortOrder?: number;
  questions: {
    label: string;
    maxScore: number;
    sortOrder?: number;
  }[];
}

export interface CreateAssessmentPayload {
  batchId: string;
  title: string;
  type: Assessment['type'];
  assessmentDate: string;
  maxScore?: number;
  sections?: AssessmentSection[] | SectionInput[];
}

export async function getAssessments(params?: { batchId?: string; type?: string }): Promise<any> {
  const res = await api.get('/api/assessments', { params });
  return res.data?.data ?? res.data;
}

export async function getAssessment(id: string): Promise<any> {
  const res = await api.get(`/api/assessments/${id}`);
  return res.data?.data ?? res.data;
}

export async function createAssessment(payload: CreateAssessmentPayload): Promise<any> {
  const res = await api.post('/api/assessments', payload);
  return res.data?.data ?? res.data;
}

export async function updateAssessment(id: string, payload: Partial<CreateAssessmentPayload>): Promise<any> {
  const res = await api.put(`/api/assessments/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteAssessment(id: string): Promise<void> {
  await api.delete(`/api/assessments/${id}`);
}

export async function submitScore(assessmentId: string, studentId: string, score: number, remarks?: string): Promise<AssessmentResult> {
  const res = await api.post(`/api/assessments/${assessmentId}/scores`, { studentId, score, remarks });
  return res.data?.data ?? res.data;
}

export async function submitQuestionScores(
  assessmentId: string,
  payload: {
    studentId: string;
    questionScores: { questionId: string; score: number }[];
    remarks?: string;
  }
): Promise<any> {
  const res = await api.post(`/api/assessments/${assessmentId}/scores`, payload);
  return res.data?.data ?? res.data;
}

export async function submitBulkScores(
  assessmentId: string,
  scores: { studentId: string; score: number; remarks?: string }[]
): Promise<{ count: number; message: string }> {
  const res = await api.post(`/api/assessments/${assessmentId}/scores/bulk`, { scores });
  return res.data?.data ?? res.data;
}

export async function bulkUploadScores(
  assessmentId: string,
  file: File
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/api/assessments/${assessmentId}/scores/bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data?.data ?? res.data;
}

export async function getAssessmentResults(assessmentId: string): Promise<any> {
  const res = await api.get(`/api/assessments/${assessmentId}/results`);
  return res.data?.data ?? res.data;
}

export const getResults = getAssessmentResults;

export async function getStudentAssessmentResult(assessmentId: string, studentId: string): Promise<AssessmentResult> {
  const res = await api.get(`/api/assessments/${assessmentId}/results/${studentId}`);
  return { ...res.data.data, score: res.data.data.overallScore };
}
