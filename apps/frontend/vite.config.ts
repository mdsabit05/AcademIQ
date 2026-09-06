import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
  },
  server: {
    host: '0.0.0.0',
    port: 2000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:2001',
        changeOrigin: true,
      },
    },
  },
})
