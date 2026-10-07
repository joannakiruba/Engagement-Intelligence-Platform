import api, { getTokenPermissions } from './api';
import { getList, normalizeEvent } from './contracts';
import { EventItem } from '../types';
export async function getEvents(): Promise<EventItem[]> {
  const own = getTokenPermissions().includes('events:read:own');
  if (own) return (await api.get('/api/events/my-events')).data.data.map(normalizeEvent);
  return (await getList('/api/events')).map(normalizeEvent);
}
export async function getEvent(id: string): Promise<EventItem> { return normalizeEvent((await api.get('/api/events/' + id)).data.data); }
export async function createEvent(payload: { title: string; description?: string; eventType: EventItem['eventType']; eventDate: string; batchIds: string[] }): Promise<EventItem> {
  return normalizeEvent((await api.post('/api/events', { title: payload.title, description: payload.description, category: payload.eventType, startDate: payload.eventDate, batchIds: payload.batchIds })).data.data);
}
export async function registerForEvent(id: string, status: 'INTERESTED' | 'REGISTERED' = 'INTERESTED'): Promise<any> { return (await api.patch('/api/events/' + id + '/status', { status })).data.data; }
