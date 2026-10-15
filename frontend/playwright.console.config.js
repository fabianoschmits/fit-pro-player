import { defineConfig } from '@playwright/test'
import config from './playwright.config.js'

// Use a separate port so console checks can run alongside the developer's app.
export default defineConfig({
  ...config,
  testMatch: '**/console.spec.js',
  use: { ...config.use, baseURL: 'http://127.0.0.1:8082' },
  webServer: { ...config.webServer, command: 'npm run dev -- --port 8082', url: 'http://127.0.0.1:8082' },
})
