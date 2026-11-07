import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

test('first-time visitor can continue without an account on the configured app', async ({ page }) => {
  await seed(page)
  await page.addInitScript(() => {
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('fpp_app_entered:anonymous')
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Navegação principal', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Seu treino, no bolso.' })).toHaveCount(0)
})

test('community visitor can open sign-in without losing the destination', async ({ page }) => {
  await seed(page)
  await page.goto('/#/community')
  await page.getByRole('button', { name: 'Entrar ou criar conta', exact: true }).click()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /email|e-mail/i })).toBeVisible()
  await expect(page).toHaveURL(/#\/community$/)
})

for (const [status, expected] of [[503, 'Este recurso está temporariamente indisponível'], [401, 'Sua sessão expirou']]) {
  test(`support displays the project error for HTTP ${status} and hides backend details`, async ({ page }) => {
    await seed(page, { rpc: { support_list_faq: { __error: { status, body: { message: 'Supabase SQL relation private_users failed', code: 'internal' } } } } })
    await page.goto('/#/support')
    await expect(page.getByRole('alert')).toContainText(expected)
    await expect(page.getByRole('alert')).not.toContainText(/supabase|SQL|private_users/i)
    await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toBeVisible()
  })
}

test('desktop install prompt uses the detected computer instructions', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop detection regression')
  const state = stateFixture(); state.pwaInstallPrompt = null
  await seed(page, { state })
  await page.goto('/#/home')
  const prompt = page.getByRole('dialog', { name: 'Instale o Fit Pro Player' })
  await expect(prompt).toBeVisible()
  await expect(prompt.getByRole('button', { name: 'PC', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(prompt.getByRole('button', { name: 'Android', exact: true })).toHaveAttribute('aria-pressed', 'false')
})
