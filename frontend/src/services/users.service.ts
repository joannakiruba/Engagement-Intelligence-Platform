import api from './api';

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
  status?: string;
  department?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  roleId?: string;
  department?: string;
  year?: number | null;
}

export interface BulkCsvResult {
  created: Array<{ row: number; email: string; userId: string }>;
  rejected: Array<{ row: number; email?: string; reason: string }>;
}

export async function getUsers(params: UserListParams = {}): Promise<UserListResponse> {
  const res = await api.get('/users', { params });
  return res.data.data;
}

export async function getUser(id: string): Promise<UserDetail> {
  const res = await api.get(`/users/${id}`);
  return res.data.data;
}

export async function getRoles(): Promise<Role[]> {
  const res = await api.get('/users/roles');
  return res.data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserDetail> {
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
