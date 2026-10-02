import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000,
  testIgnore: ['**/pwa.spec.js','**/fixtures.test.js'],
  expect: { timeout: 10000 }, reporter: [['list']],
  use: { baseURL:'http://127.0.0.1:8080', trace:'retain-on-failure', screenshot:'only-on-failure', serviceWorkers:'block' },
  projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7'],defaultBrowserType:'chromium'}}],
  webServer:{command:'npm run dev',url:'http://127.0.0.1:8080',reuseExistingServer:false,env:{VITE_STANDALONE:'1',VITE_SUPABASE_URL:'https://fitpp-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_browser_test_fixture'}},
})
