import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config.js'

const frontendRoot = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: '*.pw.js',
  outputDir: fileURLToPath(new URL('../../../test-results/home-glass/', import.meta.url)),
  projects: base.projects.filter(project => ['desktop-chromium', 'mobile-chromium'].includes(project.name)),
  webServer: { ...base.webServer, cwd: frontendRoot },
})
