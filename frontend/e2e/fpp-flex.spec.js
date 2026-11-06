import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')))
async function prepare(page, theme = 'dark') {
  const state = stateFixture()
  state.theme = theme
  state.profile.preferredWorkoutMinutes = 60
  const ids = ['0025', '0047', '0294', '0201', '0043']
  state.routines[0].ex = ids.map((id, index) => ({ id, sets: 4, reps: 12, weight: 30, rest: 180, ...(index === 2 || index === 3 ? { sg: 'pair' } : {}) }))
  state.active = { id: 'flex-browser', name: 'FPP Flex', d: '2026-11-06', routineId: 'e2e-routine', start: null, cur: 0, durationMs: 0,
    entries: state.routines[0].ex.map(target => ({ id: target.id, sg: target.sg, target, sets: Array.from({ length: 4 }, () => ({ r: 12, w: 30, done: false })) })) }
  await seed(page, { state })
  await page.goto('/#/workout')
  await expect(page.getByRole('button', { name: 'Começar treino', exact: true })).toBeVisible()
  return state
}

for (const [theme, width] of [['dark', 320], ['light', 390]]) {
  test(`FPP Flex review, recovery and confirmation in ${theme} at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 780 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const initial = await prepare(page, theme)
    await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Quanto tempo vai treinar hoje?' })).toBeVisible()
    expect((await saved(page)).active.start).toBeNull()
    await page.getByRole('button', { name: '20 min', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
    const queue = page.locator('.wp-queue-details')
    await expect(queue).toHaveAttribute('open', '')
    await expect(queue.locator('.fpp-flex-toggle')).toHaveCount(5)
    await expect(queue.locator('.is-omitted')).not.toHaveCount(0)
    await expect(queue).toBeInViewport()
    const removed = queue.locator('.fpp-flex-toggle[aria-pressed="false"]').first()
    await removed.focus()
    await removed.press('Enter')
    const review = (await saved(page)).active
    expect(review.start).toBeNull()
    expect(review.flex.phase).toBe('review')
    expect(review.flex.outline[2].selected).toBe(review.flex.outline[3].selected)
    await page.reload()
    await expect(queue).toHaveAttribute('open', '')
    await expect(page.getByRole('button', { name: 'Confirmar treino', exact: true })).toBeVisible()
    expect((await saved(page)).active.flex).toEqual(review.flex)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`fpp-flex-${theme}-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: 'Confirmar treino', exact: true }).click()
    await expect(page.locator('.set-start-action')).toBeVisible()
    const confirmed = await saved(page)
    expect(confirmed.active.start).toBeGreaterThan(0)
    expect(confirmed.active.entries).toHaveLength(review.flex.outline.filter(item => item.selected).length)
    expect(confirmed.active.entries.every(entry => entry.sets.every(set => !set.done && set.w === 30))).toBe(true)
    expect(confirmed.routines).toEqual(initial.routines)
    expect(confirmed.profile.preferredWorkoutMinutes).toBe(60)
    await page.reload()
    await expect(page.locator('.set-start-action')).toBeVisible()
    expect((await saved(page)).active.entries).toEqual(confirmed.active.entries)
  })
}

test('keeping habitual duration starts the complete prescription without review', async ({ page }) => {
  await prepare(page)
  await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
  await expect(page.getByRole('button', { name: '60 min habitual', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
  await expect(page.locator('.set-start-action')).toBeVisible()
  const active = (await saved(page)).active
  expect(active.entries).toHaveLength(5)
  expect(active.flex.phase).toBe('confirmed')
  await expect(page.locator('.fpp-flex-toggle')).toHaveCount(0)
  await expect(page.locator('.wp-queue-details')).not.toHaveAttribute('open', '')
})

test('seven-step onboarding saves duration only on completion and keeps it after reload', async ({ page }) => {
  const state = stateFixture()
  state.onboardingDone = false
  state.routines = []
  state.week = {}
  await seed(page, { state })
  await page.goto('/#/plan')
  const wizard = page.locator('.plan-wizard')
  await expect(wizard).toBeVisible()
  const next = wizard.getByRole('button', { name: 'Continuar', exact: true })
  for (let step = 0; step < 5; step++) {
    await next.click()
    await expect(wizard.locator('.wizard-progress')).toHaveAttribute('aria-valuenow', String(step + 2))
  }
  await expect(wizard.getByText('Quanto tempo você costuma treinar?', { exact: true })).toBeVisible()
  await wizard.getByRole('button', { name: '40 min', exact: true }).click()
  expect((await saved(page)).profile.preferredWorkoutMinutes).toBe(60)
  await next.click()
  await expect(wizard.locator('.wizard-progress')).toHaveAttribute('aria-valuenow', '7')
  await expect(wizard.locator('.wizard-progress')).toHaveAttribute('aria-valuemax', '7')
  await expect(wizard.locator('.wizard-schedule-preview')).toContainText('min')
  await wizard.getByRole('button', { name: 'Concluir configuração', exact: true }).click()
  await expect(wizard).toHaveCount(0)
  const completed = await saved(page)
  expect(completed.profile.preferredWorkoutMinutes).toBe(40)
  expect(completed.routines.length).toBeGreaterThan(0)
  await page.reload()
  await expect(page.locator('.plan-wizard')).toHaveCount(0)
  expect((await saved(page)).profile.preferredWorkoutMinutes).toBe(40)
})
