import api from './api';

export interface EventRound {
  id: string;
  eventId: string;
  name: string;
  roundDate: string | null;
  deadline: string | null;
  status: 'UPCOMING' | 'ONGOING' | 'DONE';
  createdAt: string;
}

export interface EventBatch {
  eventId: string;
  batchId: string;
  batch: { id: string; name: string };
}

export interface EventRegistration {
  id: string;
  eventId: string;
  studentId: string;
  status: 'PENDING' | 'INTERESTED' | 'REGISTERED' | 'WITHDRAWN';
  createdAt: string;
  updatedAt: string;
  student?: { id: string; name: string; email: string };
}

export interface EventItem {
  id: string;
  title: string;
  description: string | null;
  category: 'CODING' | 'HACKATHON' | 'OTHER';
  isMandatory: boolean;
  officialLink: string | null;
  startDate: string | null;
  endDate: string | null;
  mode: 'ONLINE' | 'OFFLINE' | null;
  venue: string | null;
  fee: number | null;
  closedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
  eventBatches?: EventBatch[];
  rounds?: EventRound[];
  registrations?: EventRegistration[];
  _count?: { registrations: number };
  statusCounts?: Record<string, number>;
  myStatus?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

const BASE = '/api/events';

export async function getEvents(params?: Record<string, string>): Promise<PaginatedResponse<EventItem>> {
  const query = new URLSearchParams(params).toString();
  const res = await api.get(`${BASE}${query ? '?' + query : ''}`);
  return { data: res.data.data, pagination: res.data.pagination };
}

export async function getEvent(id: string): Promise<EventItem> {
  const res = await api.get(`${BASE}/${id}`);
  const item = res.data.data;
  if (item.registrations?.length === 1 && !item.myStatus) {
    item.myStatus = item.registrations[0].status;
  }
  return item;
}

export async function createEventApi(data: Record<string, any>): Promise<EventItem> {
  const res = await api.post(BASE, data);
  return res.data.data;
}

export async function updateEventApi(id: string, data: Record<string, any>): Promise<EventItem> {
  const res = await api.put(`${BASE}/${id}`, data);
  return res.data.data;
}

export async function deleteEventApi(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export async function closeEventApi(id: string): Promise<EventItem> {
  const res = await api.post(`${BASE}/${id}/close`);
  return res.data.data;
}

export async function reopenEventApi(id: string): Promise<EventItem> {
  const res = await api.post(`${BASE}/${id}/reopen`);
  return res.data.data;
}

export async function addRoundApi(eventId: string, data: Record<string, any>): Promise<EventRound> {
  const res = await api.post(`${BASE}/${eventId}/rounds`, data);
  return res.data.data;
}

export async function updateRoundApi(eventId: string, roundId: string, data: Record<string, any>): Promise<EventRound> {
  const res = await api.put(`${BASE}/${eventId}/rounds/${roundId}`, data);
  return res.data.data;
}

export async function deleteRoundApi(eventId: string, roundId: string): Promise<void> {
  await api.delete(`${BASE}/${eventId}/rounds/${roundId}`);
}

export async function getMyEvents(params?: Record<string, string>): Promise<EventItem[]> {
  const query = new URLSearchParams(params).toString();
  const res = await api.get(`${BASE}/my-events${query ? '?' + query : ''}`);
  const items = res.data.data as any[];
  return items.map((item) => ({
    ...item,
    myStatus: item.myRegistration?.status ?? item.myStatus ?? null,
  }));
}

export async function setMyStatus(eventId: string, status: string): Promise<any> {
  const res = await api.patch(`${BASE}/${eventId}/status`, { status });
  return res.data.data;
}

export async function getRegistrations(eventId: string, status?: string): Promise<EventRegistration[]> {
  const query = status ? `?status=${status}` : '';
  const res = await api.get(`${BASE}/${eventId}/registrations${query}`);
  return res.data.data;
}
