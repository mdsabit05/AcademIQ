import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const stamp = Date.now()

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || './',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${stamp}.js`,
        chunkFileNames: `assets/[name]-${stamp}-[hash].js`,
        assetFileNames: `assets/[name]-${stamp}[extname]`,
      },
    },
  },
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
