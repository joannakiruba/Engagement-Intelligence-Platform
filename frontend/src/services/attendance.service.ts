import api from './api';
import type { AttendanceRecord as TypedAttendanceRecord, AttendanceWindow } from '../types';

const API = '/api/attendance';

export type { TypedAttendanceRecord as AttendanceRecordTyped, AttendanceWindow };

export interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  remarks?: string;
}

// --- Attendance Windows ---

export async function createWindow(data: {
  sessionId: string;
  label: string;
  startTime: string;
  endTime: string;
}) {
  const res = await api.post(`${API}/windows`, data);
  return res.data;
}

export async function getSessionWindows(sessionId: string) {
  const res = await api.get(`${API}/session/${sessionId}/windows`);
  return res.data;
}

// --- Window attendance ---

export async function getWindowAttendance(windowId: string) {
  const res = await api.get(`${API}/window/${windowId}`);
  return res.data;
}

// --- Session attendance (all windows combined) ---

export async function getSessionAttendance(sessionId: string) {
  const res = await api.get(`${API}/session/${sessionId}`);
  return res.data;
}

// --- Mark attendance ---

export async function markAttendance(
  windowId: string,
  studentId: string,
  status: string,
  remarks?: string
) {
  const res = await api.post(`${API}/mark`, { windowId, studentId, status, remarks });
  return res.data;
}

export async function bulkMarkAttendance(windowId: string, records: AttendanceRecord[]) {
  const res = await api.post(`${API}/bulk`, { windowId, records });
  return res.data;
}

export async function updateAttendance(id: string, data: { status?: string; remarks?: string }) {
  const res = await api.put(`${API}/${id}`, data);
  return res.data;
}

// --- Student ---

export async function getStudentAttendance(
  studentId: string,
  params?: { batchId?: string; from?: string; to?: string; sessionId?: string }
) {
  const res = await api.get(`${API}/student/${studentId}`, { params });
  return res.data;
}

// --- Batch ---

export async function getBatchAttendanceStats(batchId: string) {
  const res = await api.get(`${API}/batch/${batchId}/stats`);
  return res.data;
}

// --- Exports ---

export async function exportSessionCsv(sessionId: string) {
  const res = await api.get(`${API}/session/${sessionId}/export`, { responseType: 'blob' });
  return res.data;
}

export async function exportBatchExcel(
  batchId: string,
  params?: { from?: string; to?: string; sessionId?: string }
) {
  const res = await api.get(`${API}/batch/${batchId}/export`, { params, responseType: 'blob' });
  return res.data;
}

// --- QR ---

export async function getWindowQR(windowId: string) {
  const res = await api.get(`${API}/window/${windowId}/qr`);
  return res.data;
}

// --- Excused records (trainer review) ---

export async function getExcusedRecords(
  params?: { batchId?: string; sessionId?: string; from?: string; to?: string }
) {
  const res = await api.get(`${API}/excused`, { params });
  return res.data;
}

// --- Student check-in ---

export async function studentCheckIn(
  windowId: string,
  qrToken: string,
  extra?: { bssid?: string; ssid?: string }
) {
  const res = await api.post(`${API}/check-in`, { windowId, qrToken, ...extra });
  return res.data;
}

// --- Attendance flags (admin) ---

export interface AttendanceFlagItem {
  id: string;
  attendanceId: string;
  studentId: string;
  reason: string;
  details: string | null;
  status: string;
  reviewedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  student: { id: string; name: string; email: string };
  attendance: {
    id: string;
    windowId: string;
    studentIp: string | null;
    networkFingerprint: string | null;
    checkInTime: string | null;
    session: { id: string; title: string; scheduledDate: string };
    window: { id: string; label: string; trainerIp: string | null; networkFingerprint: string | null };
  };
  reviewer: { id: string; name: string } | null;
}

export async function getAttendanceFlags(
  params?: { status?: string; batchId?: string; from?: string; to?: string }
) {
  const res = await api.get(`${API}/flags`, { params });
  return res.data;
}

export async function resolveAttendanceFlag(flagId: string, status: 'CONFIRMED_FRAUD' | 'DISMISSED') {
  const res = await api.put(`${API}/flags/${flagId}`, { status });
  return res.data;
}

export async function getAttendanceFlagStats() {
  const res = await api.get(`${API}/flags/stats`);
  return res.data;
}

export const checkInStudent = studentCheckIn;
export const updateAttendanceRecord = updateAttendance;
export const getExcusedAttendance = getExcusedRecords;
