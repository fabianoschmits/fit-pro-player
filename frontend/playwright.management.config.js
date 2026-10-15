import { defineConfig } from '@playwright/test'
import config from './playwright.config.js'

export default defineConfig({
  ...config,
  testMatch: '**/management*.spec.js',
  use: { ...config.use, baseURL: 'http://127.0.0.1:8083' },
  webServer: { ...config.webServer, command: 'npm run dev -- --port 8083', url: 'http://127.0.0.1:8083' },
})
