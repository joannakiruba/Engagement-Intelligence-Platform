import api from './api';
import type { User, RoleName } from '../types';

export type { User, RoleName };

export async function getMe(): Promise<User> {
  const res = await api.get('/users/me');
  const d = res.data.data;
  return { ...d, role: (d.role?.name ?? d.role) as RoleName };
}

export async function updateMe(payload: Partial<User>): Promise<User> {
  const res = await api.patch('/users/me', payload);
  const d = res.data.data;
  return { ...d, role: (d.role?.name ?? d.role) as RoleName };
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  year: number | null;
  status: string;
  createdAt: string;
  role: { id: string; name: string };
}

export interface UserDetail extends UserSummary {
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
}

export interface UserListResponse {
  users: UserSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  roleId?: string;
  role?: string;
  status?: string;
  department?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roleId?: string;
  department?: string;
  year?: number | null;
  phone?: string;
}

export interface BulkCsvResult {
  created: Array<{ row: number; email: string; userId: string }>;
  rejected: Array<{ row: number; email?: string; reason: string }>;
}

export async function getUsers(params: UserListParams = {}): Promise<any> {
  const res = await api.get('/users', { params });
  const data = res.data.data;
  return Array.isArray(data) ? data : data?.users ?? data;
}

export async function getUser(id: string): Promise<UserDetail> {
  const res = await api.get(`/users/${id}`);
  return res.data.data;
}

export async function getRoles(): Promise<Role[]> {
  const res = await api.get('/users/roles');
  return res.data.data;
}

export async function createUser(payload: CreateUserPayload & { role?: string }): Promise<UserDetail> {
  const res = await api.post('/users', payload);
  return res.data.data;
}

export async function updateUser(id: string, data: Partial<Pick<UserSummary, 'name' | 'phone' | 'department' | 'year'>>): Promise<UserDetail> {
  const res = await api.patch(`/users/${id}`, data);
  return res.data.data;
}

export async function changeUserRole(id: string, roleId: string): Promise<{ message: string }> {
  const res = await api.patch(`/users/${id}/role`, { roleId });
  return res.data.data;
}

export async function changeUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<{ message: string }> {
  const res = await api.patch(`/users/${id}/status`, { status });
  return res.data.data;
}

export async function recoverUserAccount(id: string): Promise<{ message: string }> {
  const res = await api.patch(`/users/${id}/recover`);
  return res.data.data;
}

export async function bulkCreateUsers(csv: string): Promise<BulkCsvResult> {
  const res = await api.post('/admin/users/bulk-csv', { csv });
  return res.data.data;
}
