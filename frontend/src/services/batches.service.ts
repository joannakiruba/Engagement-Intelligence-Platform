import axios from "axios";

const BATCHES_API = "/api/batches";
const SESSIONS_API = "/api/sessions";

// --- Batches ---

export interface CreateBatchPayload {
  name: string;
  department?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export async function getBatches() {
  const res = await axios.get(BATCHES_API);
  return res.data;
}

export async function getBatch(id: string) {
  const res = await axios.get(`${BATCHES_API}/${id}`);
  return res.data;
}

export async function createBatch(payload: CreateBatchPayload) {
  const res = await axios.post(BATCHES_API, payload);
  return res.data;
}

export async function updateBatch(id: string, payload: Partial<CreateBatchPayload>) {
  const res = await axios.put(`${BATCHES_API}/${id}`, payload);
  return res.data;
}

export async function deleteBatch(id: string) {
  const res = await axios.delete(`${BATCHES_API}/${id}`);
  return res.data;
}

// --- Roster (Students) ---

export async function getRoster(batchId: string) {
  const res = await axios.get(`${BATCHES_API}/${batchId}/roster`);
  return res.data;
}

export async function addStudent(batchId: string, studentId: string) {
  const res = await axios.post(`${BATCHES_API}/${batchId}/students`, { studentId });
  return res.data;
}

export async function removeStudent(batchId: string, studentId: string) {
  const res = await axios.delete(`${BATCHES_API}/${batchId}/students/${studentId}`);
  return res.data;
}

// --- Trainers ---

export async function getTrainers(batchId: string) {
  const res = await axios.get(`${BATCHES_API}/${batchId}/trainers`);
  return res.data;
}

export async function assignTrainer(batchId: string, trainerId: string) {
  const res = await axios.post(`${BATCHES_API}/${batchId}/trainers`, { trainerId });
  return res.data;
}

export async function removeTrainer(batchId: string, trainerId: string) {
  const res = await axios.delete(`${BATCHES_API}/${batchId}/trainers/${trainerId}`);
  return res.data;
}

// --- Sessions ---

export interface CreateSessionPayload {
  trainerId: string;
  title: string;
  topic?: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

export async function getSessions(batchId: string) {
  const res = await axios.get(`${BATCHES_API}/${batchId}/sessions`);
  return res.data;
}

export async function createSession(batchId: string, payload: CreateSessionPayload) {
  const res = await axios.post(`${BATCHES_API}/${batchId}/sessions`, payload);
  return res.data;
}

export async function getSession(id: string) {
  const res = await axios.get(`${SESSIONS_API}/${id}`);
  return res.data;
}

export async function updateSession(id: string, payload: Partial<CreateSessionPayload>) {
  const res = await axios.put(`${SESSIONS_API}/${id}`, payload);
  return res.data;
}

export async function deleteSession(id: string) {
  const res = await axios.delete(`${SESSIONS_API}/${id}`);
  return res.data;
}
