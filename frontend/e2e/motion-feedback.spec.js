import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

test.beforeEach(async ({ page }) => {
  await seed(page)
  await page.goto('/#/motion-feedback')
  await expect(page.locator('[data-motion-showcase]')).toBeVisible()
})

test('all action states preserve geometry in both themes and every account accent', async ({ page }, testInfo) => {
  for (const theme of ['dark', 'light']) {
    await page.getByLabel('Tema do showcase').selectOption(theme)
    for (const accent of ['lime', 'sky', 'orange', 'violet', 'pink', 'red', 'teal', 'gold', 'caramel']) {
      await page.getByLabel('Cor de destaque do showcase').selectOption(accent)
      await expect(page.locator('html')).toHaveAttribute('data-accent', accent)
      const colors = await page.locator('[data-sample="idle"] .fpp-button').evaluate(button => ({
        background: getComputedStyle(button).backgroundColor,
        foreground: getComputedStyle(button).color,
      }))
      expect(colors.background).not.toBe(colors.foreground)
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
    }
    await page.screenshot({ path: testInfo.outputPath(`feedback-${theme}.png`), fullPage: true })
  }
  for (const state of ['idle', 'pressed', 'loading', 'processing', 'success', 'error', 'disabled', 'uploading', 'syncing', 'offline', 'warning']) {
    await expect(page.locator(`[data-sample="${state}"] .fpp-button`)).toHaveAttribute('data-state', state)
  }
})

test('pending action blocks repeats, keeps width stable and supports error then retry', async ({ page }) => {
  const action = page.locator('[data-probe-action]')
  const width = (await action.boundingBox()).width
  await action.dblclick()
  await expect(action).toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('[data-probe-count]')).toHaveText('1')
  await expect(action).toHaveAttribute('data-visual-state', 'loading')
  expect(Math.abs((await action.boundingBox()).width - width)).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Simular erro', exact: true }).click()
  await expect(action).toHaveAttribute('data-state', 'error')
  await expect(action).toBeEnabled()
  await action.click()
  await expect(page.locator('[data-probe-count]')).toHaveText('2')
  await page.getByRole('button', { name: 'Confirmar resultado', exact: true }).click()
  await expect(action).toHaveAttribute('data-state', 'success')
  expect(Math.abs((await action.boundingBox()).width - width)).toBeLessThanOrEqual(1)
})

test('labels every intent and exercises the critical confirmation', async ({ page }) => {
  await expect(page.locator('.motion-showcase-label').filter({ hasText: 'primary' }).first()).toContainText('intent=primary')
  await expect(page.locator('.motion-showcase-label').filter({ hasText: 'quick' }).first()).toContainText('instant local check')
  await expect(page.locator('.motion-showcase-label').filter({ hasText: 'critical' }).first()).toContainText('confirmation before commit')
  await page.getByRole('button', { name: 'Excluir' }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Excluir', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('reduced motion retains labels and disables moving feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const sample = page.locator('[data-sample="loading"] .fpp-button')
  await expect(sample).toHaveAttribute('aria-busy', 'true')
  const motion = await sample.evaluate(button => [...button.querySelectorAll('*')].map(element => ({
    animation: getComputedStyle(element).animationName,
    duration: getComputedStyle(element).transitionDuration,
  })))
  expect(motion.every(style => style.animation === 'none' && style.duration.split(',').every(value => parseFloat(value) === 0))).toBe(true)
  await expect(page.locator('[data-sample="success"] .fpp-button')).toHaveAccessibleName('Salvo')
})

test('navigation keeps one workout surface and one start action', async ({ page }) => {
  await page.goto('/#/home')
  await page.locator('[data-tab-key="start"]').click()
  await expect(page).toHaveURL(/workout/)
  expect(await page.locator('#app').count()).toBe(1)
  await page.locator('.active-workout').getByRole('button', { name: 'Começar treino', exact: true }).click()
  await expect(page.locator('.set-start-action')).toHaveCount(1)
})
