// src/services/attendance.service.ts
import api from './api';
import { AttendanceRecord, AttendanceWindow } from '../types';

export type { AttendanceRecord, AttendanceWindow };

export async function createWindow(data: {
  sessionId: string;
  label: string;
  startTime: string;
  endTime: string;
}): Promise<AttendanceWindow> {
  const res = await api.post('/api/attendance/windows', data);
  return res.data?.data ?? res.data;
}

export async function getSessionWindows(sessionId: string): Promise<any> {
  const res = await api.get(`/api/attendance/session/${sessionId}/windows`);
  return res.data?.data ?? res.data;
}

export async function getAssignedAttendanceWindows(): Promise<any[]> {
  const res = await api.get('/api/attendance/assigned-windows');
  return res.data?.data ?? res.data;
}

export async function getWindowAttendance(windowId: string): Promise<any> {
  const res = await api.get(`/api/attendance/window/${windowId}`);
  return res.data?.data ?? res.data;
}

export async function getWindowQR(windowId: string): Promise<any> {
  const res = await api.get(`/api/attendance/window/${windowId}/qr`);
  return res.data?.data ?? res.data;
}

export async function checkInStudent(
  data: { windowId?: string; qrToken?: string } | string,
  tokenArg?: string
): Promise<any> {
  const payload = typeof data === 'string' ? { windowId: data, qrToken: tokenArg } : data;
  const res = await api.post('/api/attendance/check-in', payload);
  return res.data?.data ?? res.data;
}

export const studentCheckIn = checkInStudent;

export async function markAttendance(data: {
  sessionId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
  windowId?: string;
}): Promise<any> {
  const res = await api.post('/api/attendance/mark', data);
  return res.data?.data ?? res.data;
}

export async function bulkMarkAttendance(sessionIdOrWindowId: string, records: {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}[]): Promise<any> {
  const res = await api.post('/api/attendance/bulk', { windowId: sessionIdOrWindowId, records });
  return res.data?.data ?? res.data;
}

export async function updateAttendanceRecord(id: string, data: {
  status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}): Promise<any> {
  const res = await api.put(`/api/attendance/${id}`, data);
  return res.data?.data ?? res.data;
}

export const updateAttendance = updateAttendanceRecord;

export async function getSessionAttendance(sessionId: string): Promise<any> {
  const res = await api.get(`/api/attendance/session/${sessionId}`);
  return res.data?.data ?? res.data;
}

export async function getStudentAttendance(studentId: string, params?: Record<string, string>): Promise<any> {
  const res = await api.get(`/api/attendance/student/${studentId}`, { params });
  return res.data?.data ?? res.data;
}

export async function getBatchAttendanceStats(batchId: string): Promise<any> {
  const res = await api.get(`/api/attendance/batch/${batchId}/stats`);
  return res.data?.data ?? res.data;
}

export async function getExcusedAttendance(params?: Record<string, string>): Promise<any> {
  const res = await api.get('/api/attendance/excused', { params });
  return res.data?.data ?? res.data;
}

export const getExcusedRecords = getExcusedAttendance;

export async function exportBatchExcel(batchId: string, _params?: any): Promise<Blob> {
  const res = await api.get(`/api/attendance/batch/${batchId}/export`, {
    responseType: 'blob',
  });
  return res.data;
}

export async function exportSessionCsv(sessionId: string): Promise<Blob> {
  const res = await api.get(`/api/attendance/session/${sessionId}/export`, {
    responseType: 'blob',
  });
  return res.data;
}
