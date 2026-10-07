import { getList } from './contracts';
// src/services/users.service.ts
import api from './api';
import { User, RoleName } from '../types';

export async function getMe(): Promise<User> {
  const res = await api.get('/users/me');
  const d = res.data.data;
  return {
    ...d,
    role: (d.role?.name ?? d.role) as RoleName,
  };
}

export async function updateMe(payload: Partial<User>): Promise<User> {
  const res = await api.patch('/users/me', { name: payload.name, phone: payload.phone });
  const d = res.data.data;
  return {
    ...d,
    role: (d.role?.name ?? d.role) as RoleName,
  };
}

export async function getUsers(params?: { role?: string; search?: string }): Promise<User[]> {
  const { role, ...query } = params || {};
  const rows = await getList('/users', query, 'users');
  return rows.filter((d: any) => !role || (d.role?.name ?? d.role) === role).map((d: any) => ({
    ...d,
    role: (d.role?.name ?? d.role) as RoleName,
  }));
}

export async function getUser(id: string): Promise<User> {
  const res = await api.get(`/users/${id}`);
  const d = res.data.data;
  return {
    ...d,
    role: (d.role?.name ?? d.role) as RoleName,
  };
}

export async function createUser(payload: {
  name: string;
  email: string;
  role: RoleName;
  department?: string;
  year?: number;
  phone?: string;
}): Promise<User> {
  const { role, ...fields } = payload;
  const roles = (await api.get('/users/roles')).data.data;
  const roleId = roles.find((r: any) => r.name === role)?.id;
  if (!roleId) throw new Error('Role is not configured in the database');
  const res = await api.post('/admin/users', { ...fields, roleId });
  return res.data.data;
}

export async function changeUserRole(id: string, role: RoleName): Promise<User> {
  const roles = (await api.get('/users/roles')).data.data;
  const roleId = roles.find((r: any) => r.name === role)?.id;
  if (!roleId) throw new Error('Role is not configured in the database');
  const res = await api.patch(`/admin/users/${id}/role`, { roleId });
  return res.data.data;
}

export async function changeUserStatus(id: string, status: 'ACTIVE' | 'INACTIVE' | 'PENDING'): Promise<User> {
  const res = await api.patch(`/admin/users/${id}/status`, { status });
  return res.data.data;
}
