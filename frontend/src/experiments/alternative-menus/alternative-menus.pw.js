import { test, expect } from '@playwright/test'
import { seed, stateFixture } from '../../../e2e/fixtures.test.js'

async function enterGallery(page, { admin = true, theme = 'dark' } = {}) {
  await seed(page, { authenticated: true, state: { ...stateFixture(), theme }, rpc: { ops_list_notifications: { items: [], unread_count: 0, has_more: false } } })
  await page.route('**/rest/v1/user_roles*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(admin ? [{ role: 'admin' }] : []) }))
  await page.goto('/#/console/laboratory/menus')
}

test('each menu opens independently and every icon responds without navigation', async ({ page }, testInfo) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await enterGallery(page)
  const demos = page.locator('article.am-demo')
  await expect(demos).toHaveCount(10)
  await expect(page.locator('.am-toggle[aria-expanded="false"]')).toHaveCount(10)
  await expect(page.locator('#tabbar')).toHaveCount(0)
  const url = page.url()
  const persisted = await page.evaluate(() => localStorage.getItem('fpp_navigation_layout_v1'))

  for (const demo of await demos.all()) {
    const toggle = demo.locator('.am-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    for (const item of await demo.locator('.am-item').all()) {
      await item.click()
      await expect(item).toHaveAttribute('aria-pressed', 'true')
      await expect(demo.getByRole('status')).toContainText('selecionado')
      await expect(page).toHaveURL(url)
    }
    const last = demo.locator('.am-item').last()
    await last.click()
    expect(await last.locator('.am-icon').evaluate(element => element.getAnimations().length)).toBeGreaterThan(0)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(demo.getByRole('button', { name: 'Plano', exact: true })).toHaveCount(0)
  }
  expect(await page.evaluate(() => localStorage.getItem('fpp_navigation_layout_v1'))).toBe(persisted)
  expect(errors).toEqual([])
  await page.getByRole('button', { name: 'Abrir todos', exact: true }).click()
  await expect(page.locator('.am-toggle[aria-expanded="true"]')).toHaveCount(10)
  await page.locator('.am-gallery').evaluate(async gallery => {
    await Promise.all(gallery.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
  })
  await page.locator('.am-demo[data-theme="glass"] .am-stage').screenshot({ path: testInfo.outputPath('glass-detail.png') })
  await page.screenshot({ path: testInfo.outputPath('all-menus-open.png'), fullPage: true })
  await page.getByRole('button', { name: 'Fechar todos', exact: true }).click()
  await expect(page.locator('.am-toggle[aria-expanded="false"]')).toHaveCount(10)
})

test('open menus fit narrow screens and retain keyboard feedback with reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await enterGallery(page, { theme: 'light' })
  await page.getByRole('button', { name: 'Abrir todos', exact: true }).click()
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await page.locator('.am-gallery').evaluate(gallery => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      clipped: [...gallery.querySelectorAll('.am-button')].flatMap(button => {
        const bounds = button.getBoundingClientRect()
        const stage = button.closest('.am-stage').getBoundingClientRect()
        return bounds.left < stage.left - 1 || bounds.right > stage.right + 1 || bounds.top < stage.top - 1 || bounds.bottom > stage.bottom + 1
          ? [`${button.closest('.am-demo').dataset.theme}: ${button.textContent}`] : []
      }),
      small: [...gallery.querySelectorAll('.am-button')].filter(button => button.offsetWidth < 44 || button.offsetHeight < 44).length,
    }))
    expect(geometry, `layout at ${width}px`).toEqual({ overflow: false, clipped: [], small: 0 })
  }
  await page.setViewportSize({ width: testInfo.project.name.includes('mobile') ? 320 : 1280, height: 900 })
  await page.getByRole('button', { name: 'Colorido', exact: true }).click()
  await expect(page.locator('.am-stage[data-backdrop="contrast"]')).toHaveCount(10)
  await page.screenshot({ path: testInfo.outputPath('colorful-light.png'), fullPage: true })
  const first = page.locator('article.am-demo').first()
  const item = first.getByRole('button', { name: 'Plano', exact: true })
  await item.focus()
  await page.keyboard.press('Enter')
  await expect(item).toHaveAttribute('aria-pressed', 'true')
  expect(await first.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(first.locator('.am-toggle')).toBeFocused()
  await expect(first.locator('.am-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.am-toggle[aria-expanded="true"]')).toHaveCount(9)
})

test('direct access stays unavailable to non-admin accounts', async ({ page }) => {
  await enterGallery(page, { admin: false })
  await expect(page.getByText('Sem acesso', { exact: true })).toBeVisible()
  await expect(page.locator('article.am-demo')).toHaveCount(0)
})
