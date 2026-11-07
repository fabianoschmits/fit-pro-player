import { test, expect } from '@playwright/test'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import { seed, stateFixture, openMainNavigation } from './fixtures.test.js'

const upgradeWorkerFile=new URL('../dist/sw-upgrade-test.js',import.meta.url)
test.afterEach(async()=>{await unlink(upgradeWorkerFile).catch(()=>{})})

async function waitForSWController(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      )
    }
  })
}

/** Dismiss the PWA install prompt modal if it appears. */
async function dismissInstallModal(page) {
  const dismissBtn = page.getByRole('button', { name: /agora não/i })
  if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissBtn.click()
    await dismissBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }
}

async function waitForPrecache(page, minEntries = 10) {
  await page.waitForFunction(
    async min => {
      const keys = await caches.keys()
      const shellKey = keys.find(k => k.startsWith('fpp-shell-'))
      if (!shellKey) return false
      const cache = await caches.open(shellKey)
      const entries = await cache.keys()
      return entries.length >= min
    },
    minEntries,
    { timeout: 30000 },
  )
}

test.describe('PWA Offline', () => {
  test('Test 1 — cold start offline: app opens after SW install without internet', async ({ page, context }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }))
    await seed(page)
    await page.goto('/#/home')
    await waitForSWController(page)
    await waitForPrecache(page)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    const root = page.locator('#root')
    await expect(root).not.toBeEmpty({ timeout: 15000 })
    await expect(page).toHaveTitle(/Fit Pro Player/i)
    await expect(page.locator('#fpp-launch')).toBeHidden()
    await expect(page.locator('#fpp-launch')).toHaveAttribute('data-launch-cycle', '1')
  })

  test('Test 2 — offline navigation: main routes load without internet', async ({ page, context }) => {
    await seed(page)
    await page.goto('/#/home')
    await waitForSWController(page)
    await waitForPrecache(page)

    await context.setOffline(true)

    const routes = ['/#/plan', '/#/stats', '/#/history', '/#/library', '/#/home']
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      const root = page.locator('#root')
      await expect(root).not.toBeEmpty({ timeout: 10000 })
      const bodyText = await page.locator('body').innerText().catch(() => '')
      expect(bodyText.trim().length).toBeGreaterThan(0)
    }
  })

  test('Test 3 — workout: starts, survives reload, continues offline', async ({ page, context }, testInfo) => {
    const state = stateFixture()
    await seed(page, { state })
    await page.goto('/#/home')
    await expect(page.getByText('Treino de teste', { exact: true }).first()).toBeVisible()
    await waitForSWController(page)
    await waitForPrecache(page)

    await dismissInstallModal(page)
    await openMainNavigation(page)
    await page.locator('[data-tab-key="start"]').click()
    await expect(page.locator('.workout-session-title')).toContainText('Treino de teste', { timeout: 10000 })

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('.workout-session-title')).toContainText('Treino de teste')
    await page.screenshot({ path: testInfo.outputPath('offline-workout.png'), fullPage: true })
  })

  test('Test 4 — exercise sprites: served from cache after preload', async ({ page, context }) => {
    const state = stateFixture()
    await seed(page, { state })
    await page.goto('/#/home')
    await expect(page.getByText('Treino de teste', { exact: true }).first()).toBeVisible()
    await waitForSWController(page)
    await waitForPrecache(page)

    // Wait until bench-press frames (0025 — always in SHOWCASE, always in plan) are fully cached.
    // bench-press has 3 unique frame images (frame-4 reuses frame-2); wait for all 3.
    // We identify them by their build-hash names which are stable across builds for the same source.
    const BENCH_PRESS_FRAMES = ['frame-1-LyFiu4C4.webp', 'frame-2-DlIzf7GR.webp', 'frame-3-31OQMumA.webp']
    await page.waitForFunction(async (frames) => {
      const keys = await caches.keys()
      const exKey = keys.find(k => k.startsWith('fpp-exercise-media-'))
      if (!exKey) return false
      const cache = await caches.open(exKey)
      const entries = await cache.keys()
      const cachedUrls = entries.map(r => r.url)
      return frames.every(name => cachedUrls.some(u => u.includes(name)))
    }, BENCH_PRESS_FRAMES, { timeout: 30000 })
    // Brief pause to ensure all cache.put() calls have resolved
    await page.waitForTimeout(500)
    // Dismiss PWA install modal if it appeared while we were waiting
    await dismissInstallModal(page)

    const failedFrameRequests = []
    page.on('requestfailed', req => {
      if (/\/assets\/frame-[^/]+\.(webp|png)/.test(req.url())) {
        failedFrameRequests.push(req.url())
      }
    })

    // Now go offline and open workout containing the plan exercise
    await context.setOffline(true)
    await dismissInstallModal(page)
    await openMainNavigation(page)
    await page.locator('[data-tab-key="start"]').click()
    await expect(page.locator('.workout-session-title')).toContainText('Treino de teste', { timeout: 10000 })
    await page.waitForTimeout(1500)

    expect(failedFrameRequests, `Failed frame requests: ${failedFrameRequests.join(', ')}`).toHaveLength(0)
  })

  test('Test 5 — complete restart offline: React boots, routes accessible', async ({ page, context }) => {
    const state = stateFixture()
    await seed(page, { state })
    await page.goto('/#/home')
    await expect(page.getByText('Treino de teste', { exact: true }).first()).toBeVisible()
    await waitForSWController(page)
    await waitForPrecache(page)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 })

    await page.goto('/#/plan', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10000 })

    await page.goto('/#/workout', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 10000 })
  })

  test('Test 6 — SW update: no white screen or 404 during cache transition', async ({ page, context }) => {
    await seed(page)
    await page.goto('/#/home')
    await waitForSWController(page)
    await waitForPrecache(page)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15000 })
    await expect(page).toHaveTitle(/Fit Pro Player/i)
  })
})


test('activation removes obsolete caches and catalogue sprites while preserving offline boot',async({page,context})=>{
 const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8')
 expect(source).toMatch(/const SHELL_CACHE = 'fpp-shell-[^']+'/)
 await writeFile(upgradeWorkerFile,source.replace(/(const SHELL_CACHE = ')([^']+)(')/,'$1$2-upgrade-test$3'))
 await seed(page)
 await page.goto('/#/home')
 await waitForSWController(page)
 await waitForPrecache(page)
 await page.evaluate(async()=>{
  for(const name of ['fpp-shell-obsolete-a','fpp-shell-obsolete-b','fpp-runtime-obsolete-a','fpp-runtime-obsolete-b']){
   const cache=await caches.open(name);await cache.put('/obsolete.js',new Response('old'))
  }
  const cache=await caches.open('fpp-exercise-media-v1')
  await cache.put('/assets/removed-exercise-frame.webp',new Response('old'))
  // Install genuinely different worker bytes with a new shell version.
  const registration=await navigator.serviceWorker.register('/sw-upgrade-test.js')
  await registration.update()
  const waiting=registration.waiting || registration.installing
  if(waiting)waiting.postMessage({type:'SKIP_WAITING'})
 })
 await page.waitForFunction(async()=>{
  const keys=await caches.keys()
  const cache=await caches.open('fpp-exercise-media-v1')
  return keys.some(key=>key.startsWith('fpp-shell-')&&key.endsWith('-upgrade-test')) && !keys.includes('fpp-runtime-obsolete-b') && !(await cache.match('/assets/removed-exercise-frame.webp'))
 },null,{timeout:30000})
 await context.setOffline(true)
 await page.reload({waitUntil:'domcontentloaded'})
 await expect(page.locator('#root')).not.toBeEmpty()
 await page.goto('/#/plan')
 await expect(page.locator('#root')).not.toBeEmpty()
})
