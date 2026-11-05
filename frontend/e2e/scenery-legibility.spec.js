import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

test('photo headers keep readable text in dark and light themes', async ({ page }, testInfo) => {
 test.setTimeout(180000)
 await seed(page, { professional: true, rpc: {
  professional_profiles: { professional_name: 'Profissional Teste', specialties: [], city_name: 'Porto Alegre', state_uf: 'RS' },
 } })
 const screens = [
  ['/home', '.home-titlebar h1', '.profile-hero-facts'],
  ['/plan', '.app-header h1', '.app-header .sub'],
  ['/workout', '.hdr h1', '.hdr .sub'],
  ['/library', '.app-header h1'],
  ['/progress', '.app-header h1'],
  ['/progress/history', '.app-header h1'],
  ['/progress/body', '.bp-header h1'],
  ['/community', '.community-topbar h1', '.community-intro'],
  ['/community/messages', '.app-header h1'],
  ['/professional/students', '.app-header h1'],
  ['/professional/invites', '.app-header h1'],
  ['/professional/templates/new', '.app-header h1'],
  ['/professional/profile', '.app-header h1', '.app-header .sub'],
  ['/student/professionals', '.app-header h1'],
 ]
 for (const [route, title, subtitle] of screens) {
  await page.goto(`/#${route}`)
  await expect(page.locator(title).first()).toBeVisible()
  for (const theme of ['dark', 'light']) {
   await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
   const heading = page.locator(title).first()
   expect(await heading.evaluate(element => getComputedStyle(element).textShadow), `${route} ${theme} title shadow`).not.toBe('none')
   if (subtitle && await page.locator(subtitle).count()) {
    const color = await page.locator(subtitle).first().evaluate(element => getComputedStyle(element).color)
    expect(color, `${route} ${theme} opaque supporting text`).toMatch(/^rgb\(/)
   }
   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true)
   await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll('/', '_')}-${theme}.png`), animations: 'disabled' })
  }
 }
 await page.goto('/#/personal-data')
 await expect(page.locator('.app-header h1')).toBeVisible()
 expect(await page.locator('.app-header h1').evaluate(element => getComputedStyle(element).textShadow)).toBe('none')
})

test('active workout and weight goal copy stay readable over the home and player photos', async ({ page }, testInfo) => {
 const state = stateFixture()
 state.targetW = 70
 state.profile.startWeight = 80
 state.bodyweight = [{ w: 75, d: '2026-11-05', t: 1 }]
 state.active = { id: 'scenery-active-workout', d: '2026-11-05', name: 'Dia de Empurrar', routineId: 'e2e-routine', start: Date.now(), durationMs: 0, cur: 0,
  entries: [{ id: '0025', target: { mode: 'reps', bodyweight: false, weight: 20, reps: 10, rest: 90 }, sets: [{ w: 20, r: 10, done: false }] }] }
 await seed(page, { state })
 for (const [route, selectors] of [
  ['/home', ['.profile-hero-goal-head', '.profile-hero-facts', '.home-now-context', '.home-now-progress-label']],
  ['/workout', ['.workout-session-title']],
 ]) {
  await page.goto(`/#${route}`)
  for (const selector of selectors) await expect(page.locator(selector)).toBeVisible()
  for (const theme of ['dark', 'light']) {
   await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
   for (const selector of selectors) {
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).textShadow)).not.toBe('none')
   }
   await page.screenshot({ path: testInfo.outputPath(`active-${route.slice(1)}-${theme}.png`), animations: 'disabled' })
  }
 }
})
