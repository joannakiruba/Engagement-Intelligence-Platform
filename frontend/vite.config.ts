import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:3000';
  const proxy = Object.fromEntries(['/api', '/auth', '/users', '/admin/users', '/health'].map(path => [path, { target, changeOrigin: true, bypass(req: any) { if (req.headers.accept?.includes('text/html') && !req.url?.startsWith('/api')) return '/index.html'; } }]));
  return { plugins: [react(), tailwindcss()], server: { port: 5173, strictPort: true, proxy }, preview: { port: 5173, strictPort: true, proxy } };
});
