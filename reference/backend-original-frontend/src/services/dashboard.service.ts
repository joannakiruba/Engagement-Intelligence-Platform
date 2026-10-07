import api from './api';

// --- Events ---

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  eventDate: string;
  registrationDeadline: string | null;
  createdAt: string;
  _count?: { registrations: number; proofSubmissions: number };
}

export async function getEvents(): Promise<EventItem[]> {
  const res = await api.get('/api/events');
  return res.data.data;
}

export async function getEvent(id: string): Promise<EventItem> {
  const res = await api.get(`/api/events/${id}`);
  return res.data.data;
}

// --- Proof Submissions ---

export interface ProofSubmission {
  id: string;
  eventId: string;
  studentId: string;
  fileUrl: string;
  fileName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks: string | null;
  createdAt: string;
  event?: { id: string; title: string; eventType: string; eventDate?: string };
  student?: { id: string; name: string; email: string };
}

export async function getMyProofs(): Promise<ProofSubmission[]> {
  const res = await api.get('/api/proofs/my');
  return res.data.data;
}

export async function getAllProofs(filters?: {
  eventId?: string;
  studentId?: string;
  status?: string;
}): Promise<ProofSubmission[]> {
  const params = new URLSearchParams();
  if (filters?.eventId) params.set('eventId', filters.eventId);
  if (filters?.studentId) params.set('studentId', filters.studentId);
  if (filters?.status) params.set('status', filters.status);
  const res = await api.get(`/api/proofs?${params.toString()}`);
  return res.data.data;
}

export async function getProofDetail(id: string): Promise<ProofSubmission> {
  const res = await api.get(`/api/proofs/${id}`);
  return res.data.data;
}

export async function submitProof(
  eventId: string,
  file: File,
): Promise<ProofSubmission> {
  const formData = new FormData();
  formData.append('eventId', eventId);
  formData.append('file', file);
  const res = await api.post('/api/proofs', formData);
  return res.data.data;
}

export async function replaceProofFile(
  proofId: string,
  file: File,
): Promise<ProofSubmission> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.put(`/api/proofs/${proofId}/file`, formData);
  return res.data.data;
}

export async function reviewProof(
  proofId: string,
  status: 'APPROVED' | 'REJECTED',
  remarks?: string,
): Promise<ProofSubmission> {
  const res = await api.patch(`/api/proofs/${proofId}/review`, { status, remarks });
  return res.data.data;
}
