import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'
import base from '../../../playwright.config.js'

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: '*.pw.js',
  outputDir: fileURLToPath(new URL('../../../test-results/alternative-menus/', import.meta.url)),
  projects: base.projects.filter(project => ['desktop-chromium', 'mobile-chromium'].includes(project.name)),
  webServer: { ...base.webServer, cwd: fileURLToPath(new URL('../../../', import.meta.url)) },
})
