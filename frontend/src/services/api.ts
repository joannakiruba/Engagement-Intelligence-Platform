import axios from 'axios';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

const api = axios.create({ baseURL: '/', withCredentials: true });

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

export default api;
