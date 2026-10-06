import api from './api';
import { EventItem } from '../types';

export async function getEvents(): Promise<EventItem[]> {
  const res = await api.get('/api/events');
  return res.data.data;
}

export async function getEvent(id: string): Promise<EventItem> {
  const res = await api.get(`/api/events/${id}`);
  return res.data.data;
}

export async function createEvent(payload: {
  title: string;
  description?: string;
  eventType: EventItem['eventType'];
  eventDate: string;
  registrationDeadline?: string;
}): Promise<EventItem> {
  const res = await api.post('/api/events', payload);
  return res.data.data;
}

export async function updateEvent(id: string, payload: {
  title?: string;
  description?: string;
  eventType?: EventItem['eventType'];
  eventDate?: string;
  registrationDeadline?: string | null;
}): Promise<EventItem> {
  const res = await api.put(`/api/events/${id}`, payload);
  return res.data.data;
}
