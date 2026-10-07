import { getList } from './contracts';
// src/services/batches.service.ts
import api from './api';
import { Batch, Session, User } from '../types';

export interface CreateBatchPayload {
  name: string;
  department?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export async function getBatches(): Promise<any> {
  return getList('/api/batches', {}, 'batches');
}

export async function getBatch(id: string): Promise<any> {
  const res = await api.get(`/api/batches/${id}`);
  return res.data?.data ?? res.data;
}

export async function createBatch(payload: CreateBatchPayload): Promise<any> {
  const res = await api.post('/api/batches', payload);
  return res.data?.data ?? res.data;
}

export async function updateBatch(id: string, payload: Partial<CreateBatchPayload>): Promise<any> {
  const res = await api.put(`/api/batches/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteBatch(id: string): Promise<void> {
  await api.delete(`/api/batches/${id}`);
}

export async function getBatchRoster(batchId: string): Promise<any> {
  const res = await api.get(`/api/batches/${batchId}/roster`);
  return res.data?.data ?? res.data;
}

export const getRoster = getBatchRoster;

export async function addStudentToBatch(batchId: string, studentId: string): Promise<any> {
  const res = await api.post(`/api/batches/${batchId}/students`, { studentId });
  return res.data?.data ?? res.data;
}

export const addStudent = addStudentToBatch;

export async function removeStudentFromBatch(batchId: string, studentId: string): Promise<void> {
  await api.delete(`/api/batches/${batchId}/students/${studentId}`);
}

export const removeStudent = removeStudentFromBatch;

export async function getBatchTrainers(batchId: string): Promise<any> {
  const res = await api.get(`/api/batches/${batchId}/trainers`);
  return res.data?.data ?? res.data;
}

export async function assignTrainerToBatch(batchId: string, trainerId: string): Promise<any> {
  const res = await api.post(`/api/batches/${batchId}/trainers`, { trainerId });
  return res.data?.data ?? res.data;
}

export const assignTrainer = assignTrainerToBatch;

export async function removeTrainerFromBatch(batchId: string, trainerId: string): Promise<void> {
  await api.delete(`/api/batches/${batchId}/trainers/${trainerId}`);
}

export const removeTrainer = removeTrainerFromBatch;

export async function getBatchSessions(batchId: string): Promise<any> {
  const res = await api.get(`/api/batches/${batchId}/sessions`);
  return res.data?.data ?? res.data;
}

export const getSessions = getBatchSessions;

export async function createSession(batchId: string, payload: {
  title: string;
  topic?: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  room?: string;
  trainerId?: string;
}): Promise<any> {
  const res = await api.post(`/api/batches/${batchId}/sessions`, payload);
  return res.data?.data ?? res.data;
}

export async function getSession(id: string): Promise<any> {
  const res = await api.get(`/api/sessions/${id}`);
  return res.data?.data ?? res.data;
}

export async function updateSession(id: string, payload: Partial<Session>): Promise<any> {
  const res = await api.put(`/api/sessions/${id}`, payload);
  return res.data?.data ?? res.data;
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/api/sessions/${id}`);
}
