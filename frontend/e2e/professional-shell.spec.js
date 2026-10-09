import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'

const name = 'Ana Carolina Albuquerque de Oliveira e Silva — acompanhamento individual de força e condicionamento'
const rpc = {
  professional_profiles: { user_id: USER, professional_name: name, verification_status: 'verified' },
  professional_client_summaries: [{ student_user_id: STUDENT, display_name: name, program_title: 'Força e condicionamento' }],
}
for (const width of [375, 1280]) test(`professional shell prototype ${width}px`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit viewport prototype.')
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = stateFixture()
  state.active = { id: 'personal-active', rid: 'e2e-routine', name: 'Treino de teste', start: Date.now(), entries: [] }
  await seed(page, { professional: true, state, rpc })
  await page.goto('/#/professional/students')
  const nav = page.getByRole('navigation', { name: 'Navegação da área profissional' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link')).toHaveText(['Gestão', 'Alunos', 'Programas', 'Convites'])
  await expect(page.locator('#tabbar')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Retomar treino', exact: true })).toHaveAttribute('href', '#/workout')
  await expect(page.getByRole('link', { name: new RegExp('Ana Carolina') })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const bounds = await nav.boundingBox()
  if (width === 375) expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(899)
  else expect(bounds.width).toBeLessThan(200)
  await page.screenshot({ path: testInfo.outputPath(`shell-${width}.png`), fullPage: true })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
  await page.screenshot({ path: testInfo.outputPath(`shell-${width}-light.png`), fullPage: true })
  expect(await nav.evaluate(element => getComputedStyle(element).color)).not.toBe('rgb(245, 247, 248)')
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.getByRole('button', { name: 'Área profissional', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Perfil', exact: true }).click()
  await expect(page).toHaveURL(/#\/professional\/profile$/)
  await page.getByRole('button', { name: 'Área profissional', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await page.goBack()
  await expect(page).toHaveURL(/#\/professional\/students$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/#/professional-profile')
  await expect(nav).toBeVisible()
  await expect(page.locator('#tabbar')).toHaveCount(0)
  await page.getByRole('button', { name: 'Área profissional', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Perfil', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.goto('/#/home')
  await expect(page.locator('#tabbar')).toBeVisible()
  await expect(nav).toHaveCount(0)
})

test('action sheet hands history to confirmation Dialog before the next browser Back', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit browser history regression.')
  await page.goto('/e2e/professional-shell-fixture.html')
  await page.getByRole('button', { name: 'Ações do programa', exact: true }).click()
  await page.getByRole('button', { name: 'Excluir programa', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirmar exclusão' })
  await expect(dialog).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeTruthy()
  await page.goBack()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
})

test('closing and immediately reopening a sheet waits for its asynchronous history traversal', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit browser history regression.')
  await page.goto('/e2e/professional-shell-fixture.html')
  const trigger = page.getByRole('button', { name: 'Ações do programa', exact: true })
  await trigger.click()
  // Commit removal, then dispatch input before Chromium delivers real popstate.
  await page.evaluate(() => window.closeAndImmediatelyReopen())
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeFalsy()
  await expect(trigger).toBeEnabled()
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Ações do programa' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => history.state?.fitProPlayerDialog)).toBeTruthy()
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

for (const width of [800, 1280]) test(`shell icon targets are at least 44px at ${width}px`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Explicit target viewport.')
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/e2e/professional-shell-fixture.html')
  const buttons = page.locator('.professional-native .iconbtn')
  await expect(buttons).toHaveCount(4)
  for (const button of await buttons.all()) {
    const bounds = await button.boundingBox()
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
})
