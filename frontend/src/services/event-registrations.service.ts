import api from './api';
import { EventRegistration } from '../types';

export async function registerForEvent(eventId: string): Promise<EventRegistration> {
  const res = await api.post('/api/event-registrations', { eventId });
  return res.data.data;
}

export async function getMyRegistrations(): Promise<EventRegistration[]> {
  const res = await api.get('/api/event-registrations/my');
  return res.data.data;
}

export async function getAllRegistrations(filters?: {
  eventId?: string;
  studentId?: string;
}): Promise<EventRegistration[]> {
  const params = new URLSearchParams();
  if (filters?.eventId) params.set('eventId', filters.eventId);
  if (filters?.studentId) params.set('studentId', filters.studentId);
  const query = params.toString();
  const res = await api.get(`/api/event-registrations${query ? `?${query}` : ''}`);
  return res.data.data;
}

export async function cancelRegistration(id: string): Promise<void> {
  await api.delete(`/api/event-registrations/${id}`);
}
