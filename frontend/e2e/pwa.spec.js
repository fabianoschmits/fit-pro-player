import { test, expect } from '@playwright/test'
import {readFile,writeFile,unlink} from 'node:fs/promises'
import { seed, stateFixture, openMainNavigation, startWorkoutExecution } from './fixtures.test.js'

import { exerciseGuideAsset } from '../src/lib/exercise-guide-assets.js'
import { WEEKLY_NOW, weeklyState } from './weekly-fixtures.js'

const upgradeWorkerFile=new URL('../dist/sw-upgrade-test.js',import.meta.url)
test.afterEach(async()=>{await unlink(upgradeWorkerFile).catch(()=>{})})

test('weekly summary cold-loads offline, changes weeks and keeps anatomy and selection after reload', async ({ page, context }, info) => {
  await page.clock.setFixedTime(WEEKLY_NOW)
  await seed(page, { state: weeklyState() }); await page.goto('/#/home')
  await waitForSWController(page); await waitForPrecache(page)
  const cached = await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('fpp-shell-'))
    return (await (await caches.open(name)).keys()).map(request => request.url)
  })
  expect(cached.some(url => /WeeklyProgress-[^/]+\.js/.test(url))).toBe(true)
  expect(cached.some(url => /body-paths-[^/]+\.js/.test(url))).toBe(true)
  await context.setOffline(true); await page.goto('/#/progress/weekly')
  await expect(page.locator('[data-weekly-metric="completedSets"] strong')).toHaveText('24')
  await expect(page.locator('.weekly-insights')).toContainText('aumentou em 10 min.')
  await expect(page.locator('.weekly-progress-view').getByRole('status')).toContainText('Você está offline')
  await page.getByRole('button', { name: 'Semana anterior', exact: true }).click()
  await expect(page).toHaveURL(/week=2026-11-09/)
  await expect(page.locator('[data-weekly-metric="completedSets"] strong')).toHaveText('38')
  await page.locator('.weekly-muscle-ranking').getByRole('button', { name: /^Peito/ }).click()
  await expect(page.locator('.weekly-muscle-detail')).toContainText('38')
  await expect(page.locator('[data-weekly-muscles] .bm-v').first()).toBeVisible()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/week=2026-11-09/)
  await expect(page.locator('[data-weekly-metric="completedSets"] strong')).toHaveText('38')
  await page.screenshot({ path: info.outputPath('weekly-offline.png'), fullPage: true })
})

test('a real offline workout updates the weekly summary and reconnecting never duplicates it', async ({ page, context }) => {
  await page.clock.setFixedTime(WEEKLY_NOW)
  await seed(page, { state: stateFixture() }); await page.goto('/#/home')
  await waitForSWController(page); await waitForPrecache(page)
  await context.setOffline(true)
  await page.locator('.home-now').getByRole('button', { name: 'Começar Treino de teste', exact: true }).click()
  await startWorkoutExecution(page)
  await page.locator('.set-start-action').click()
  await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Salvar', exact: true }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar treino', exact: true }).click()
  await page.getByLabel('Nota curta (opcional)', { exact: true }).fill('Conclusão offline semanal')
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar treino', exact: true }).click()
  await page.getByRole('button', { name: 'Ver minha semana', exact: true }).click()
  await expect(page.locator('[data-weekly-metric="workouts"] strong')).toHaveText('1')
  await expect(page.locator('[data-weekly-metric="completedSets"] strong')).toHaveText('1')
  const savedId = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).workouts[0].id)
  await context.setOffline(false)
  await expect(page.locator('.weekly-notice')).toHaveCount(0)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-weekly-metric="workouts"] strong')).toHaveText('1')
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem('gym_state_v1')).workouts.filter(workout => workout.id === id).length, savedId)).toBe(1)
})

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
    await startWorkoutExecution(page)
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active)
    expect(before.start).toBeTruthy()
    expect(before.entries).toHaveLength(1)

    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.locator('.workout-session-title')).toContainText('Treino de teste')
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active)
    expect(restored.id).toBe(before.id)
    expect(restored.entries).toEqual(before.entries)
    expect(restored.comparison).toEqual(before.comparison)
    await expect(page.locator('.wp-exercise-player')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('offline-workout.png'), fullPage: true })
  })

  test('Test 4 — exercise sprites: served from cache after preload', async ({ page, context }) => {
    const state = stateFixture()
    await seed(page, { state })
    await page.goto('/#/home')
    await expect(page.getByText('Treino de teste', { exact: true }).first()).toBeVisible()
    await waitForSWController(page)
    await waitForPrecache(page)

    await openMainNavigation(page)
    await page.locator('[data-tab-key="start"]').click()
    await startWorkoutExecution(page)
    const animation = page.locator('.wp-media-card [data-exercise-animation="0025"]')
    const frameCount = new Set(exerciseGuideAsset({ id: '0025' }).sequence).size
    const images = animation.locator('img')
    await expect(images).toHaveCount(frameCount)
    await expect.poll(() => images.evaluateAll(items => items.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    const frames = await images.evaluateAll(items => items.map(image => image.currentSrc || image.src))
    // URLs come from the rendered catalogue mapping for this build, including
    // all frame positions even when identical source files share a build hash.
    await page.waitForFunction(async frames => {
      const name = (await caches.keys()).find(key => key.startsWith('fpp-exercise-media-'))
      if (!name) return false
      const cache = await caches.open(name)
      return (await Promise.all(frames.map(url => cache.match(url)))).every(Boolean)
    }, frames)
    await context.setOffline(true)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(images).toHaveCount(frameCount)
    await expect.poll(() => images.evaluateAll(items => items.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
    expect(await images.evaluateAll(items => items.map(image => image.currentSrc || image.src))).toEqual(frames)
    const first = await animation.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')
    await expect.poll(() => animation.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')).not.toBe(first)
  })

  test('training map cold-loads its lazy route and anatomy offline with persisted snapshots', async ({ page, context }, testInfo) => {
    const state = stateFixture()
    const muscleWeights = { chest: 1, triceps: .4 }
    const snapshot = workSets => [{ exerciseId: '0025', workSets, muscleWeights: { ...muscleWeights } }]
    state.workouts = [{ id: 'offline-map', d: '2026-11-23', name: 'Mapa offline', start: 1795446000000, end: 1795447800000,
      comparison: { version: 1, origin: 'personal', planned: snapshot(3), adjusted: snapshot(2), flexApplied: true },
      entries: [{ id: '0025', muscleSnapshot: { muscleWeights: { ...muscleWeights } }, sets: [{ done: true, r: 10, w: 20 }, { done: true, r: 10, w: 20 }] }],
    }]
    await seed(page, { state })
    await page.goto('/#/home')
    await waitForSWController(page)
    // Do not visit the lazy comparison route before disconnecting. Its code and
    // anatomy must come from the existing shell precache on the first visit.
    await page.waitForFunction(async () => {
      const key = (await caches.keys()).find(name => name.startsWith('fpp-shell-'))
      if (!key) return false
      const urls = (await (await caches.open(key)).keys()).map(request => request.url)
      return urls.some(url => /\/TrainingComparison-[^/]+\.js$/.test(url)) && urls.some(url => /\/body-paths-[^/]+\.js$/.test(url))
    }, undefined, { timeout: 30000 })
    await context.setOffline(true)
    await page.goto('/#/progress/training-map?session=offline-map', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Planejado × Realizado', exact: true })).toBeVisible()
    await expect(page.locator('[data-comparison-execution]')).toContainText('100%')
    const stages = page.getByRole('group', { name: 'Etapa do treino' })
    await stages.getByRole('button', { name: 'Original', exact: true }).click()
    await expect(stages.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await stages.getByRole('button', { name: 'Realizado', exact: true }).click()
    await page.locator('.tc-map-panel.is-active .bm-v').getByRole('button', { name: 'Peito', exact: true }).first().click()
    await expect(page.locator('.tc-muscle-detail dl')).toContainText('Original3Ajustado2Realizado2')
    await page.screenshot({ path: testInfo.outputPath('offline-training-map.png'), fullPage: true })
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
