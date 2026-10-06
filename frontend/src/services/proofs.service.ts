import api from './api';
import { ProofSubmission } from '../types';

export async function getProofs(filters?: {
  eventId?: string;
  studentId?: string;
  status?: string;
}): Promise<ProofSubmission[]> {
  const params = new URLSearchParams();
  if (filters?.eventId) params.set('eventId', filters.eventId);
  if (filters?.studentId) params.set('studentId', filters.studentId);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString();
  const res = await api.get(`/api/proofs${query ? `?${query}` : ''}`);
  return res.data.data;
}

export async function getMyProofs(): Promise<ProofSubmission[]> {
  const res = await api.get('/api/proofs/my');
  return res.data.data;
}

export async function getProofDetail(id: string): Promise<ProofSubmission> {
  const res = await api.get(`/api/proofs/${id}`);
  return res.data.data;
}

export async function submitProof(eventId: string, file: File): Promise<ProofSubmission> {
  const formData = new FormData();
  formData.append('eventId', eventId);
  formData.append('file', file);
  const res = await api.post('/api/proofs', formData);
  return res.data.data;
}

export async function replaceProofFile(proofId: string, file: File): Promise<ProofSubmission> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.put(`/api/proofs/${proofId}/file`, formData);
  return res.data.data;
}

export async function reviewProof(id: string, status: 'APPROVED' | 'REJECTED', remarks?: string): Promise<ProofSubmission> {
  const res = await api.patch(`/api/proofs/${id}/review`, { status, remarks });
  return res.data.data;
}
