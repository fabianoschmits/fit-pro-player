import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

export default defineConfig({
  plugins: [react()],
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
