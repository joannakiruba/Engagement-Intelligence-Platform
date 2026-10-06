import api, { setAccessToken } from './api';
import type { User, RoleName } from '../types';

export type LoginUser = User;

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export async function login(email: string, password?: string): Promise<LoginResponse> {
  const res = await api.post('/auth/login', { email, password });
  const { accessToken, user } = res.data.data;
  setAccessToken(accessToken);
  return { accessToken, user };
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

export async function restoreSession(): Promise<User | null> {
  try {
    const profileRes = await api.get('/users/me');
    const data = profileRes.data?.data;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: (data.role?.name ?? data.role) as RoleName,
      department: data.department,
      year: data.year,
      phone: data.phone,
      status: data.status,
    };
  } catch {
    try {
      const refreshRes = await api.post('/auth/refresh');
      const newToken = refreshRes.data?.data?.accessToken;
      if (!newToken) {
        setAccessToken(null);
        return null;
      }
      setAccessToken(newToken);
      const secondProfile = await api.get('/users/me');
      const data = secondProfile.data?.data;
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: (data.role?.name ?? data.role) as RoleName,
        department: data.department,
        year: data.year,
        phone: data.phone,
        status: data.status,
      };
    } catch {
      setAccessToken(null);
      return null;
    }
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await api.post('/auth/change-password', { currentPassword, newPassword });
  return res.data;
}
