# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend\e2e\motion-feedback.spec.js >> reduced motion retains labels and disables moving feedback
- Location: frontend\e2e\motion-feedback.spec.js:48:1

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/#/motion-feedback", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { seed } from './fixtures.test.js'
  3  | 
  4  | test.beforeEach(async ({ page }) => {
  5  |   await seed(page)
> 6  |   await page.goto('/#/motion-feedback')
     |              ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  7  |   await expect(page.locator('[data-motion-showcase]')).toBeVisible()
  8  | })
  9  | 
  10 | test('all action states preserve geometry in both themes and every account accent', async ({ page }, testInfo) => {
  11 |   for (const theme of ['dark', 'light']) {
  12 |     await page.getByLabel('Tema do showcase').selectOption(theme)
  13 |     for (const accent of ['lime', 'sky', 'orange', 'violet', 'pink', 'red', 'teal', 'gold', 'caramel']) {
  14 |       await page.getByLabel('Cor de destaque do showcase').selectOption(accent)
  15 |       await expect(page.locator('html')).toHaveAttribute('data-accent', accent)
  16 |       const colors = await page.locator('[data-sample="idle"] .fpp-button').evaluate(button => ({
  17 |         background: getComputedStyle(button).backgroundColor,
  18 |         foreground: getComputedStyle(button).color,
  19 |       }))
  20 |       expect(colors.background).not.toBe(colors.foreground)
  21 |       expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
  22 |     }
  23 |     await page.screenshot({ path: testInfo.outputPath(`feedback-${theme}.png`), fullPage: true })
  24 |   }
  25 |   for (const state of ['idle', 'pressed', 'loading', 'processing', 'success', 'error', 'disabled', 'uploading', 'syncing', 'offline', 'warning']) {
  26 |     await expect(page.locator(`[data-sample="${state}"] .fpp-button`)).toHaveAttribute('data-state', state)
  27 |   }
  28 | })
  29 | 
  30 | test('pending action blocks repeats, keeps width stable and supports error then retry', async ({ page }) => {
  31 |   const action = page.locator('[data-probe-action]')
  32 |   const width = (await action.boundingBox()).width
  33 |   await action.dblclick({ force: true })
  34 |   await expect(action).toHaveAttribute('aria-busy', 'true')
  35 |   await expect(page.locator('[data-probe-count]')).toHaveText('1')
  36 |   await expect(action).toHaveAttribute('data-visual-state', 'loading')
  37 |   expect(Math.abs((await action.boundingBox()).width - width)).toBeLessThanOrEqual(1)
  38 |   await page.getByRole('button', { name: 'Simular erro', exact: true }).click()
  39 |   await expect(action).toHaveAttribute('data-state', 'error')
  40 |   await expect(action).toBeEnabled()
  41 |   await action.click()
  42 |   await expect(page.locator('[data-probe-count]')).toHaveText('2')
  43 |   await page.getByRole('button', { name: 'Confirmar resultado', exact: true }).click()
  44 |   await expect(action).toHaveAttribute('data-state', 'success')
  45 |   expect(Math.abs((await action.boundingBox()).width - width)).toBeLessThanOrEqual(1)
  46 | })
  47 | 
  48 | test('reduced motion retains labels and disables moving feedback', async ({ page }) => {
  49 |   await page.emulateMedia({ reducedMotion: 'reduce' })
  50 |   const sample = page.locator('[data-sample="loading"] .fpp-button')
  51 |   await expect(sample).toHaveAttribute('aria-busy', 'true')
  52 |   const motion = await sample.evaluate(button => [...button.querySelectorAll('*')].map(element => ({
  53 |     animation: getComputedStyle(element).animationName,
  54 |     duration: getComputedStyle(element).transitionDuration,
  55 |   })))
  56 |   expect(motion.every(style => style.animation === 'none' && style.duration.split(',').every(value => parseFloat(value) === 0))).toBe(true)
  57 |   await expect(page.locator('[data-sample="success"] .fpp-button')).toHaveAccessibleName('Salvo')
  58 | })
  59 | 
```