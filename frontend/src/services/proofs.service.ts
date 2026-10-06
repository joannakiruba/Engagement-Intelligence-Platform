// src/services/proofs.service.ts
import api from './api';
import { ProofSubmission } from '../types';

export async function getProofs(): Promise<ProofSubmission[]> {
  const res = await api.get('/api/proofs');
  return res.data.data;
}

export async function getMyProofs(): Promise<ProofSubmission[]> {
  const res = await api.get('/api/proofs/my');
  return res.data.data;
}

export async function submitProof(payload: {
  eventId: string;
  fileName: string;
  fileUrl?: string;
}): Promise<ProofSubmission> {
  const res = await api.post('/api/proofs', payload);
  return res.data.data;
}

export async function reviewProof(id: string, status: 'APPROVED' | 'REJECTED', remarks?: string): Promise<ProofSubmission> {
  const res = await api.patch(`/api/proofs/${id}/review`, { status, remarks });
  return res.data.data;
}
