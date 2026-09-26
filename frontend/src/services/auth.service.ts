import api, { setAccessToken } from './api';

export interface LoginUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  user: LoginUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
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

export async function restoreSession(): Promise<LoginUser | null> {
  try {
    const refreshRes = await api.post('/auth/refresh');
    const newToken = refreshRes.data?.data?.accessToken;
    if (!newToken) return null;
    setAccessToken(newToken);

    const profileRes = await api.get('/users/me');
    const data = profileRes.data?.data;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role?.name ?? data.role,
    };
  } catch {
    setAccessToken(null);
    return null;
  }
}
