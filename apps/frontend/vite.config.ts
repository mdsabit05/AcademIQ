import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer'

const stamp = Date.now()

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      // Convert PNG/JPG/JPEG to WebP and compress — runs at build time
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { lossless: false, quality: 80, alphaQuality: 90 },
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'AcademIQ',
        short_name: 'AcademIQ',
        description: 'AI-powered study assistant',
        theme_color: '#0D1220',
        background_color: '#080C14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,woff2}'],
        runtimeCaching: [
          {
            // API calls — network-first so fresh data when online,
            // falls back to cached response when offline
            urlPattern: /^https?:\/\/.*\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Google Fonts — cache-first
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
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
