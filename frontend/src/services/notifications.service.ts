import api from './api';
import { Notification } from '../types';

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export async function getNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  const res = await api.get('/api/notifications', { params: { page, limit } });
  return res.data.data;
}

export async function markAsRead(id: string): Promise<Notification> {
  const res = await api.patch(`/api/notifications/${id}/read`);
  return res.data.data;
}

export async function markAllAsRead(): Promise<{ markedRead: number }> {
  const res = await api.post('/api/notifications/mark-all-read');
  return res.data.data;
}
