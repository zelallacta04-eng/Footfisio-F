import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Lee .env.local completo (incluido NOCODB_API_TOKEN, que NO llega al navegador porque no lleva VITE_).
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      // Equivale a la Cloudflare Pages Function, pero para `npm run dev` en tu PC.
      proxy: {
        '/api/nocodb': {
          target: (env.NOCODB_UPSTREAM_URL || 'https://app.nocodb.com').replace(/\/$/, ''),
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/nocodb/, ''),
          headers: { 'xc-token': env.NOCODB_API_TOKEN || '' },
        },
      },
    },
    preview: { host: '0.0.0.0', port: 4173 },
  }
})
