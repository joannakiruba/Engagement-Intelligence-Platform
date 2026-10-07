import api, { setAccessToken, refreshSession } from './api';
import { User } from '../types';
import { getMe } from './users.service';
export interface LoginResponse { accessToken: string; user: User; }
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post('/auth/login', { email, password });
  setAccessToken(res.data.data.accessToken);
  const user = await getMe();
  return { accessToken: res.data.data.accessToken, user };
}
export async function logout(): Promise<void> { try { await api.post('/auth/logout'); } finally { setAccessToken(null); } }
export async function restoreSession(): Promise<User | null> { if (!await refreshSession()) return null; try { return await getMe(); } catch { setAccessToken(null); return null; } }
export async function changePassword(currentPassword: string, newPassword: string) { return (await api.post('/auth/change-password', { currentPassword, newPassword })).data; }
