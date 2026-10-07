import api from "./api";

const BATCHES_API = "/api/batches";
const SESSIONS_API = "/api/sessions";

// --- Types ---

export interface BatchSummary {
  id: string;
  name: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  memberCount: number;
  trainerCount: number;
  sessionCount: number;
}

export interface BatchListResponse {
  batches: BatchSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface BatchListParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
}

export interface BatchDetail {
  id: string;
  name: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  trainers: BatchTrainer[];
  memberCount: number;
  sessionCount: number;
}

export interface BatchTrainer {
  id: string;
  name: string;
  email: string;
  assignedAt: string;
}

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  department: string | null;
  joinedAt: string;
}

export interface SessionItem {
  id: string;
  title: string;
  topic: string | null;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  trainer: { id: string; name: string; email: string };
  batch?: { id: string; name: string };
}

export interface CreateBatchPayload {
  name: string;
  department?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface CreateSessionPayload {
  trainerId: string;
  title: string;
  topic?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

// --- Batches ---

export async function getBatches(params: BatchListParams = {}): Promise<BatchListResponse> {
  const res = await api.get(BATCHES_API, { params });
  return res.data.data;
}

export async function getBatch(id: string): Promise<BatchDetail> {
  const res = await api.get(`${BATCHES_API}/${id}`);
  return res.data.data;
}

export async function createBatch(payload: CreateBatchPayload) {
  const res = await api.post(BATCHES_API, payload);
  return res.data;
}

export async function updateBatch(id: string, payload: Partial<CreateBatchPayload>) {
  const res = await api.put(`${BATCHES_API}/${id}`, payload);
  return res.data;
}

export async function deleteBatch(id: string) {
  const res = await api.delete(`${BATCHES_API}/${id}`);
  return res.data;
}

// --- Roster (Students) ---

export async function getRoster(batchId: string): Promise<RosterStudent[]> {
  const res = await api.get(`${BATCHES_API}/${batchId}/roster`);
  return res.data.data;
}

export async function addStudent(batchId: string, studentId: string) {
  const res = await api.post(`${BATCHES_API}/${batchId}/students`, { studentId });
  return res.data;
}

export async function removeStudent(batchId: string, studentId: string) {
  const res = await api.delete(`${BATCHES_API}/${batchId}/students/${studentId}`);
  return res.data;
}

// --- Trainers ---

export async function getTrainers(batchId: string): Promise<BatchTrainer[]> {
  const res = await api.get(`${BATCHES_API}/${batchId}/trainers`);
  return res.data.data;
}

export async function assignTrainer(batchId: string, trainerId: string) {
  const res = await api.post(`${BATCHES_API}/${batchId}/trainers`, { trainerId });
  return res.data;
}

export async function removeTrainer(batchId: string, trainerId: string) {
  const res = await api.delete(`${BATCHES_API}/${batchId}/trainers/${trainerId}`);
  return res.data;
}

// --- Sessions ---

export async function getSessions(batchId: string): Promise<SessionItem[]> {
  const res = await api.get(`${BATCHES_API}/${batchId}/sessions`);
  return res.data.data;
}

export async function createSession(batchId: string, payload: CreateSessionPayload) {
  const res = await api.post(`${BATCHES_API}/${batchId}/sessions`, payload);
  return res.data;
}

export async function getSession(id: string): Promise<SessionItem> {
  const res = await api.get(`${SESSIONS_API}/${id}`);
  return res.data.data;
}

export async function updateSession(id: string, payload: Partial<CreateSessionPayload>) {
  const res = await api.put(`${SESSIONS_API}/${id}`, payload);
  return res.data;
}

export async function deleteSession(id: string) {
  const res = await api.delete(`${SESSIONS_API}/${id}`);
  return res.data;
}
