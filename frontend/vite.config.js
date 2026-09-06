import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server on 5173 (default) -- matches the CORS allow-list in
// backend/app/main.py. If you change this port, update that too.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

