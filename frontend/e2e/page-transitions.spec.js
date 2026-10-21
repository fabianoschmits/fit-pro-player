import { test, expect } from '@playwright/test'
import { seed, openMainNavigation } from './fixtures.test.js'

async function enter(page, reducedMotion = 'no-preference') {
  await page.emulateMedia({ reducedMotion })
  await seed(page)
  await page.addInitScript(() => {
    window.routeEntrances = []
    window.maxAppCopies = 0
    const animate = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options)
      if (this.id === 'app') window.routeEntrances.push({ path: location.hash, frames, duration: animation.effect.getTiming().duration })
      return animation
    }
    new MutationObserver(() => {
      window.maxAppCopies = Math.max(window.maxAppCopies, document.querySelectorAll('#app').length)
    }).observe(document, { childList: true, subtree: true })
  })
  await page.goto('/#/home')
  await expect(page.locator('.home-view')).toBeVisible()
  await openMainNavigation(page)
}

test('page changes fade on touch and desktop with one persistent app surface', async ({ page }) => {
  await enter(page)
  const original = await page.locator('#app').elementHandle()
  await page.locator('[data-tab-key="plan"]').click()
  await expect(page).toHaveURL(/#\/plan$/)
  await expect.poll(() => page.evaluate(() => window.routeEntrances.length)).toBeGreaterThan(0)
  await expect(page.locator('#app')).toHaveCount(1)
  expect(await page.locator('#app').evaluate((element, first) => element === first, original)).toBe(true)
  const motion = await page.evaluate(() => ({ copies: window.maxAppCopies, entrances: window.routeEntrances }))
  expect(motion.copies).toBe(1)
  expect(motion.entrances.every(entrance => entrance.duration >= 100 && entrance.duration <= 250)).toBe(true)
  expect(motion.entrances.every(entrance => entrance.frames.every(frame => !frame.transform && frame.opacity != null))).toBe(true)
  await expect(page.locator('.corner-nav-toggle')).toBeVisible()
})

test('reduced motion and keyboard navigation keep page changes immediate', async ({ page }) => {
  await enter(page, 'reduce')
  await page.locator('[data-tab-key="plan"]').click()
  await expect(page).toHaveURL(/#\/plan$/)
  await expect(page.locator('.plan-mode-section')).toBeVisible()
  expect(await page.evaluate(() => window.routeEntrances)).toEqual([])
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.locator('[data-tab-key="home"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.home-view')).toBeVisible()
  expect(await page.evaluate(() => window.routeEntrances)).toEqual([])
  await expect(page.locator('#app')).toHaveCount(1)
  await page.locator('[data-tab-key="plan"]').click()
  await expect.poll(() => page.evaluate(() => window.routeEntrances.length)).toBeGreaterThan(0)
  const before = await page.evaluate(() => window.routeEntrances.length)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('[data-tab-key="home"]').click()
  await expect(page.locator('.home-view')).toBeVisible()
  expect(await page.evaluate(() => window.routeEntrances.length)).toBe(before)
})

test('a cold lazy page fades only after its destination content is ready', async ({ page }) => {
  let release
  const available = new Promise(resolve => { release = resolve })
  let requested = false
  await page.route('**/src/views/BodyProgress.jsx*', async route => {
    requested = true
    await available
    await route.continue()
  })
  try {
    await enter(page)
    await page.evaluate(() => { location.hash = '/body-progress' })
    await expect.poll(() => requested).toBe(true)
    // Hold the real module longer than the entire entrance animation.
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => window.routeEntrances.length)).toBe(0)
    release()
    await expect(page.locator('.body-progress-view')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.routeEntrances.length)).toBeGreaterThan(0)
    await expect(page.locator('#app')).toHaveCount(1)
  } finally {
    release()
  }
})
