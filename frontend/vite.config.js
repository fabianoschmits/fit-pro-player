import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'
import { inlineAppleTouchIcon } from './build/inline-apple-touch-icon.js'

const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

export default defineConfig({
  plugins: [inlineAppleTouchIcon(), react()],
  // Browser and unit-test optimizers must not invalidate each other's dependency URLs.
  cacheDir: process.env.VITEST ? 'node_modules/.vite-unit' : `node_modules/.vite-browser-${process.env.FPP_E2E_PORT || 'app'}`,
  optimizeDeps: { include: ['qrcode'], holdUntilCrawlEnd: false },
  test: { exclude: [...configDefaults.exclude, 'e2e/**'] },
  base: './',
  server: {
    proxy: {
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  // The only chunk above Vite's default is the optional Hindi instruction catalogue
  // (1.58 MB raw / ~122 kB gzip), fetched only after that language is selected.
  build: { chunkSizeWarningLimit: 1600 }
})
