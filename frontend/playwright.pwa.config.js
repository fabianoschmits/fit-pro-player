import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir:'./e2e',testMatch:'**/pwa.spec.js',outputDir:'./test-results-pwa',workers:1,timeout:45000,
  use:{...devices['Pixel 7'],defaultBrowserType:'chromium',baseURL:'http://127.0.0.1:8081',serviceWorkers:'allow',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 8081 --strictPort',url:'http://127.0.0.1:8081',reuseExistingServer:false},
})
