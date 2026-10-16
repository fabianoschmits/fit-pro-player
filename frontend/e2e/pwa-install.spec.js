import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

test('installation offer survives navigation and requires confirmation before reporting installed', async ({ page }) => {
  await seed(page)
  await page.goto('/#/home')
  await expect(page.locator('[data-tab-key="start"]')).toBeVisible()
  await page.evaluate(() => {
    window.installCalls = 0
    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = () => { window.installCalls++; return Promise.resolve() }
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })
    window.dispatchEvent(event)
  })
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Dicas e instalação', exact: true }).click()
  const install = page.getByRole('button', { name: 'Instalar Fit Pro Player', exact: true })
  await expect(install).toBeVisible()
  expect(await page.evaluate(() => window.installCalls)).toBe(0)
  await install.click()
  expect(await page.evaluate(() => window.installCalls)).toBe(1)
  await expect(page.getByText('Instalação autorizada', { exact: true })).toBeVisible()
  await expect(page.getByText('Fit Pro Player instalado', { exact: true })).toHaveCount(0)
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(page.getByText('Fit Pro Player instalado', { exact: true })).toBeVisible()
  await expect(install).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'iPhone / iPad', exact: true })).toBeVisible()
})

test('manual instructions cover each platform without horizontal overflow', async ({ page }, testInfo) => {
  await seed(page)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Dicas e instalação', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Instale o Fit Pro Player', exact: true })).toBeVisible()
  for (const platform of ['iPhone / iPad', 'Android', 'Computador']) {
    await page.getByRole('button', { name: platform, exact: true }).click()
    const guide = page.locator('.pwa-install-guide')
    await expect(guide).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, `${platform} should fit the viewport`).toBe(false)
  }
  await page.getByRole('button', { name: 'iPhone / iPad', exact: true }).click()
  await expect(page.locator('.pwa-install-guide')).toContainText('Safari')
  await expect(page.locator('.pwa-install-guide')).toContainText('Chrome')
  await page.screenshot({ path: testInfo.outputPath('pwa-install-guide.png'), fullPage: true })
})
