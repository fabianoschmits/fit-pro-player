import { defineConfig, devices } from '@playwright/test'
const port = Number(process.env.FPP_E2E_PORT || 8080)
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000,
  testIgnore: ['**/pwa.spec.js','**/fixtures.test.js'],
  expect: { timeout: 10000 }, reporter: [['list']],
  use: { baseURL, trace:'retain-on-failure', screenshot:'only-on-failure', serviceWorkers:'block' },
  projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}},{name:'mobile-webkit',testMatch:['**/pwa-viewport.spec.js','**/pwa-install.spec.js'],use:{...devices['iPhone 13'],defaultBrowserType:'webkit'}}],
  webServer:{command:`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port} --strictPort`,url:baseURL,reuseExistingServer:false,env:{VITE_STANDALONE:'1',VITE_SUPABASE_URL:'https://fitpp-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_browser_test_fixture'}},
})
