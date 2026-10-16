import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

const iphoneChrome = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.39 Mobile/15E148 Safari/604.1'
const iphoneWebApp = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

async function installed(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  })
}

for (const [name, userAgent] of [['iPhone Chrome', iphoneChrome], ['iPhone Home Screen', iphoneWebApp]]) {
  test.describe(name, () => {
    test.use({ userAgent })

    test('installed landing and fullscreen login stay below the status bar', async ({ page }) => {
      await installed(page)
      await page.goto('/')
      const brand = page.locator('.landing-nav-brand')
      await expect(brand).toBeVisible()
      expect((await brand.boundingBox()).y).toBeGreaterThanOrEqual(62)
      await page.getByRole('button', { name: 'Personalizar', exact: true }).click()
      await page.getByRole('button', { name: 'Salvar escolhas', exact: true }).click()
      await expect(page.locator('.privacy-consent-backdrop')).toBeHidden()
      await page.locator('.landing-actions .btn.primary').click()
      const form = page.locator('.auth-form')
      await expect(form).toBeVisible()
      expect((await form.boundingBox()).y).toBeGreaterThanOrEqual(62)
      expect(await page.locator('.sheet.auth-fullscreen').evaluate(el => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844)
    })

    test('installed routes, profile bubble and sticky workout keep top clearance', async ({ page }, testInfo) => {
      await installed(page)
      await seed(page)
      for (const path of ['/home', '/plan', '/stats', '/more', '/settings', '/privacy', '/support', '/body-progress']) {
        await page.goto(`/#${path}`)
        await expect(page.locator('#app')).toBeVisible()
        await expect.poll(() => page.locator('#app').evaluate(el => parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(88)
        await expect(page.locator('.landing-page')).toHaveCount(0)
      }
      await page.goto('/#/home')
      const bubble = page.locator('.profile-hero-message')
      await expect(bubble).toBeVisible()
      expect((await bubble.boundingBox()).y).toBeGreaterThanOrEqual(62)
      await page.screenshot({ path: testInfo.outputPath('installed-home.png') })
      await page.locator('[data-tab-key="start"]').click()
      const title = page.locator('.workout-session-title')
      await expect(title).toBeVisible()
      expect((await title.boundingBox()).y).toBeGreaterThanOrEqual(62)
      await page.evaluate(() => window.scrollTo(0, 300))
      await expect.poll(async () => (await title.boundingBox()).y).toBeGreaterThanOrEqual(62)
      expect(await page.locator('#tabbar').evaluate(el => el.getBoundingClientRect().bottom)).toBe(844)
      await page.setViewportSize({ width: 844, height: 390 })
      await expect.poll(() => page.locator('#app').evaluate(el => parseFloat(getComputedStyle(el).paddingTop))).toBeLessThan(44)
    })
  })
}

test('regular mobile Chrome keeps its normal page spacing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page)
  await page.goto('/#/home')
  await expect(page.locator('.profile-hero')).toBeVisible()
  expect(await page.locator('#app').evaluate(el => parseFloat(getComputedStyle(el).paddingTop))).toBe(8)
})

test.describe('Android Chrome installed display mode', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36' })

  test('reserves extra top clearance without moving the bottom bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window)
      window.matchMedia = query => {
        const media = matchMedia(query)
        if (query === '(display-mode: standalone)') Object.defineProperty(media, 'matches', { value: true })
        return media
      }
    })
    await seed(page)
    await page.goto('/#/home')
    await expect(page.locator('.profile-hero')).toBeVisible()
    expect(await page.locator('#app').evaluate(el => parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThanOrEqual(32)
    expect(await page.locator('#tabbar').evaluate(el => el.getBoundingClientRect().bottom)).toBe(844)
  })
})

test.describe('installed tablet console', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' })

  test('sidebar links remain below the sticky header after scrolling', async ({ page }) => {
    await installed(page)
    await page.setViewportSize({ width: 768, height: 1024 })
    await seed(page, { authenticated: true, rpc: {
      ops_list_users: Array.from({ length: 35 }, (_, index) => ({
        user_id: `user-${index}`, display_name: `Pessoa ${index}`, email: `user-${index}@example.invalid`, roles: [], account_kind: 'account',
      })),
    } })
    await page.route('**/rest/v1/user_roles*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ role: 'admin' }]) }))
    await page.goto('/#/console/users')
    await expect(page.locator('.console-main')).toContainText('Pessoa 34')
    await page.evaluate(() => window.scrollTo(0, 300))
    await expect.poll(async () => {
      const header = await page.locator('.console-topbar').boundingBox()
      const link = await page.locator('.console-navigation a').first().boundingBox()
      return link.y - (header.y + header.height)
    }).toBeGreaterThanOrEqual(0)
  })
})
