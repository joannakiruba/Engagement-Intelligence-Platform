import api from './api';
import { Task, TaskSubmission } from '../types';

export interface CreateTaskPayload {
  title: string;
  description?: string;
  isMandatory?: boolean;
  isInternal?: boolean;
  maxMarks?: number;
  deadlineType?: 'FIXED' | 'TENTATIVE' | 'TBD' | 'NONE';
  deadline?: string;
  deadlineNote?: string;
  batchIds: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  isMandatory?: boolean;
  isInternal?: boolean;
  maxMarks?: number | null;
  addBatchIds?: string[];
}

export interface ChangeDeadlinePayload {
  deadlineType: 'FIXED' | 'TENTATIVE' | 'TBD' | 'NONE';
  deadline?: string;
  deadlineNote?: string;
  reason?: string;
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

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const res = await api.put(`/api/tasks/${id}`, payload);
  return res.data.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/api/tasks/${id}`);
}

export async function changeDeadline(id: string, payload: ChangeDeadlinePayload): Promise<Task> {
  const res = await api.patch(`/api/tasks/${id}/deadline`, payload);
  return res.data.data;
}

export async function closeTask(id: string): Promise<Task> {
  const res = await api.post(`/api/tasks/${id}/close`);
  return res.data.data;
}

export async function reopenTask(id: string): Promise<Task> {
  const res = await api.post(`/api/tasks/${id}/reopen`);
  return res.data.data;
}

export async function updateTaskProgress(taskId: string, payload: {
  progress: 'NOT_STARTED' | 'IN_PROGRESS' | 'ALMOST_COMPLETED' | 'COMPLETED';
}): Promise<TaskSubmission> {
  const res = await api.patch(`/api/tasks/${taskId}/progress`, payload);
  return res.data.data;
}

export async function toggleInterested(taskId: string): Promise<TaskSubmission> {
  const res = await api.post(`/api/tasks/${taskId}/interested`);
  return res.data.data;
}

export async function addStudent(taskId: string, studentId: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/students`, { studentId });
}

export async function setTaskMarks(taskId: string, studentId: string, marksAwarded: number): Promise<TaskSubmission> {
  const res = await api.put(`/api/tasks/${taskId}/marks`, { studentId, marksAwarded });
  return res.data.data;
}

export async function bulkSetTaskMarks(taskId: string, entries: { studentId: string; marksAwarded: number }[]): Promise<void> {
  await api.post(`/api/tasks/${taskId}/marks/bulk`, { entries });
}

export async function exportTaskMarks(taskId: string): Promise<Blob> {
  const res = await api.get(`/api/tasks/${taskId}/marks/export`, { responseType: 'blob' });
  return res.data;
}
