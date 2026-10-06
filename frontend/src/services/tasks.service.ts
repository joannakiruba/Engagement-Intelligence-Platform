// src/services/tasks.service.ts
import api from './api';
import { Task, TaskSubmission } from '../types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  isMandatory?: boolean;
  isInternal?: boolean;
  maxMarks?: number;
  deadlineType?: 'HARD' | 'SOFT' | 'NONE';
  deadline?: string;
  batchIds?: string[];
}

export async function getTasks(): Promise<Task[]> {
  const res = await api.get('/api/tasks');
  return res.data.data;
}

export async function getMyTasks(): Promise<{ task: Task; submission: TaskSubmission }[]> {
  const res = await api.get('/api/tasks/my-tasks');
  return res.data.data;
}

export async function getTask(id: string): Promise<Task> {
  const res = await api.get(`/api/tasks/${id}`);
  return res.data.data;
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const res = await api.post('/api/tasks', payload);
  return res.data.data;
}

export async function updateTask(id: string, payload: Partial<CreateTaskPayload>): Promise<Task> {
  const res = await api.put(`/api/tasks/${id}`, payload);
  return res.data.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/api/tasks/${id}`);
}

export async function updateTaskProgress(taskId: string, payload: {
  progress?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  isInterested?: boolean;
  studentNotes?: string;
}): Promise<TaskSubmission> {
  const res = await api.post(`/api/tasks/${taskId}/progress`, payload);
  return res.data.data;
}

export async function setTaskMarks(taskId: string, studentId: string, marksAwarded: number): Promise<TaskSubmission> {
  const res = await api.post(`/api/tasks/${taskId}/marks`, { studentId, marksAwarded });
  return res.data.data;
}
