import axios from 'axios';

let accessToken: string | null = localStorage.getItem('eip_access_token');
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem('eip_access_token', token);
  } else {
    localStorage.removeItem('eip_access_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await axios.post('/auth/refresh', {}, { withCredentials: true });
    return res.data?.data?.accessToken ?? null;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.startsWith('/auth/')
    ) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = tryRefresh().finally(() => {
          refreshPromise = null;
        });
      }
      const newToken = await refreshPromise;
      if (newToken) {
        setAccessToken(newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(err: any): string {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

export default api;
