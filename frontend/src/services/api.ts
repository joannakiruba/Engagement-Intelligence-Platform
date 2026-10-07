import axios from 'axios';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const baseURL = import.meta.env.VITE_API_BASE_URL || '/';
export function setAccessToken(token: string | null) { accessToken = token; localStorage.removeItem('hope_access_token'); }
export function getAccessToken() { return accessToken; }
export function getTokenPermissions(): string[] {
  try { const part = accessToken!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); const p = JSON.parse(atob(part)).permissions; return Array.isArray(p) ? p : []; } catch { return []; }
}
const transport = axios.create({ baseURL, withCredentials: true });
const api = axios.create({ baseURL, withCredentials: true });
export function refreshSession(): Promise<string | null> {
  if (!refreshPromise) refreshPromise = transport.post('/auth/refresh', {}).then(res => { const token = res.data?.data?.accessToken ?? null; setAccessToken(token); return token; }).catch(() => { setAccessToken(null); return null; }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}
api.interceptors.request.use(config => { if (accessToken) config.headers.Authorization = 'Bearer ' + accessToken; return config; });
api.interceptors.response.use(res => res, async error => {
  const original = error.config;
  if (original && error.response?.status === 401 && !original._retry && !['/auth/login', '/auth/refresh', '/auth/activate', '/auth/forgot-password', '/auth/reset-password'].includes(original.url)) {
    original._retry = true;
    if (await refreshSession()) return api(original);
    window.dispatchEvent(new Event('hope:session-expired'));
  }
  if (!error.response || error.response.status >= 500) {
    window.dispatchEvent(new CustomEvent('hope:service-error', { detail: 'Some data could not be loaded or saved. Check the service connection and retry; empty dashboard counts may be incomplete.' }));
  }
  return Promise.reject(error);
});
export function getErrorMessage(err: any): string {
  const message = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message;
  return typeof message === 'string' ? message : 'The request failed. Please try again.';
}
export default api;
