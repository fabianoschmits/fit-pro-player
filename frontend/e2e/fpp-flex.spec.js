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
  test(`animated previews are centered and the selected time can change in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 780 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const original = await prepare(page, theme)
    await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
    await page.getByRole('button', { name: '20 min', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
    const queue = page.locator('.wp-queue-details')
    const animations = queue.locator('.fpp-flex-preview [data-exercise-animation]')
    await expect(animations).toHaveCount(5)
    const animation = animations.first()
    await animation.scrollIntoViewIfNeeded()
    await expect(animation).not.toHaveAttribute('aria-busy', 'true')
    const frame = () => animation.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')
    const initial = await frame()
    await expect.poll(frame).not.toBe(initial)
    const alignment = await animation.evaluate(element => {
      const parent = element.parentElement.getBoundingClientRect(), rect = element.getBoundingClientRect()
      return { offset: Math.abs(parent.x + parent.width / 2 - rect.x - rect.width / 2), fit: getComputedStyle(element.querySelector('img')).objectFit }
    })
    expect(alignment.offset).toBeLessThan(1)
    expect(alignment.fit).toBe('contain')
    await expect(queue.locator('.fpp-flex-duration')).toContainText('Tempo escolhido: 20 min')
    await queue.getByRole('button', { name: 'Pausar animações', exact: true }).click()
    await expect(animation).not.toHaveClass(/is-playing/)
    await queue.getByRole('button', { name: 'Alterar tempo', exact: true }).click()
    await expect(page.getByRole('button', { name: '20 min', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: '40 min', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
    await expect(queue.locator('.fpp-flex-duration')).toContainText('Tempo escolhido: 40 min')
    expect((await saved(page)).active.start).toBeNull()
    expect((await saved(page)).profile.preferredWorkoutMinutes).toBe(60)
    expect((await saved(page)).routines).toEqual(original.routines)
    await queue.getByRole('button', { name: 'Animar exercícios', exact: true }).click()
    await expect(animation).toHaveClass(/is-playing/)
    await page.screenshot({ path: testInfo.outputPath(`flex-animated-${theme}.png`), fullPage: true })
  })
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
    await expect(queue).not.toHaveAttribute('open', '')
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
  await page.locator('.wp-queue-details > summary').click()
  const items = page.locator('.wp-queue-details .workout-exercise-tab')
  await expect(items).toHaveCount(5)
  await expect(items.nth(2)).toContainText('Supersérie')
  await expect(items.nth(3)).toContainText('Supersérie')
  await expect(items.nth(2).locator('.thumb')).toHaveCount(1)
  await expect(items.nth(3).locator('.thumb')).toHaveCount(1)
  await items.nth(3).click()
  expect((await saved(page)).active.cur).toBe(3)
  expect((await saved(page)).active.entries.every(entry => entry.sets.every(set => !set.done))).toBe(true)
  await page.locator('.wp-main-action.set-start-action').click()
  const controls = page.locator('.wp-current-controls')
  await expect(controls.locator('.wp-bump-btn:enabled')).toHaveCount(0)
  expect(await controls.getByRole('textbox').evaluateAll(inputs => inputs.every(input => input.disabled))).toBe(true)
  await page.locator('.wp-main-action.is-executing').click()
  await expect.poll(() => controls.locator('.wp-bump-btn:enabled').count()).toBeGreaterThan(0)
  expect(await controls.getByRole('textbox').evaluateAll(inputs => inputs.every(input => !input.disabled))).toBe(true)
})

for (const decision of ['Manter meus treinos', 'Readequar treinos', 'dismiss']) {
  test(`habitual duration is saved while refit requires explicit choice: ${decision}`, async ({ page }) => {
    const state = stateFixture()
    state.profile.preferredWorkoutMinutes = 60
    const automatic = state.routines[0]
    automatic.ex = [{ id: '0025', sets: 6, reps: 12, weight: 80, rest: 180 }]
    automatic.planGenerated = true
    automatic.personalizedKey = 'full'
    automatic.planSignature = JSON.stringify(automatic.ex, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
    state.routines.push({ id: 'manual', name: 'Manual', ex: [{ id: '0043', sets: 5, reps: 10, weight: 40 }] })
    state.active = { id: 'unchanged-active', routineId: 'manual', start: 1, cur: 0, entries: [{ id: '0043', sets: [{ w: 40, r: 10, done: false }] }] }
    state.workouts = [{ id: 'history', entries: [] }]
    await seed(page, { state })
    await page.goto('/#/personal-data')
    const field = page.locator('[data-profile-field="preferredWorkoutMinutes"]')
    await field.getByRole('button', { name: 'Editar Tempo habitual de treino', exact: true }).click()
    await field.getByRole('button', { name: '40 min', exact: true }).click()
    await field.locator('.personal-save').click()
    await expect(page.getByRole('heading', { name: 'Readequar seus treinos?', exact: true })).toBeVisible()
    expect((await saved(page)).profile.preferredWorkoutMinutes).toBe(40)
    expect((await saved(page)).routines).toEqual(state.routines)
    if (decision === 'dismiss') await page.keyboard.press('Escape')
    else await page.getByRole('button', { name: decision, exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Readequar seus treinos?', exact: true })).toHaveCount(0)
    const after = await saved(page)
    if (decision === 'Readequar treinos') expect(after.routines[0].ex).not.toEqual(automatic.ex)
    else expect(after.routines).toEqual(state.routines)
    expect(after.routines[1]).toEqual(state.routines[1])
    expect(after.active).toEqual(state.active)
    expect(after.workouts).toEqual(state.workouts)
    expect(after.week).toEqual(state.week)
    await page.reload()
    await expect(field.locator('.personal-field-summary')).toHaveText('40 minutos')
    expect((await saved(page)).routines).toEqual(after.routines)
  })
}

test('seven-step onboarding saves duration only on completion and keeps it after reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
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
  const estimates = await page.evaluate(async routines => {
    const durationModule = '/src/lib/workout-duration.js'
    const { estimateWorkoutDuration } = await import(durationModule)
    return routines.map(routine => estimateWorkoutDuration(routine.ex) / 60)
  }, completed.routines)
  for (const minutes of estimates) {
    expect(minutes).toBeGreaterThanOrEqual(32)
    expect(minutes).toBeLessThanOrEqual(40)
  }
  expect(completed.routines.every(routine => routine.planTemplateVersion === 2 && routine.planTargetMinutes === 40)).toBe(true)
  expect(completed.routines.every(routine => !/push|pull/i.test(routine.starterKey))).toBe(true)
  await page.reload()
  await expect(page.locator('.plan-wizard')).toHaveCount(0)
  expect((await saved(page)).profile.preferredWorkoutMinutes).toBe(40)
})

test('exercise queue animates both directions and collapses after confirming the selection', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await prepare(page)
  await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
  await page.getByRole('button', { name: '20 min', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
  const queue = page.locator('.wp-queue-details')
  await expect(queue.getByRole('button', { name: 'Confirmar treino', exact: true })).toBeVisible()
  await queue.getByRole('button', { name: 'Confirmar treino', exact: true }).click()
  await expect(queue).not.toHaveAttribute('open', '')
  expect((await saved(page)).active.entries.every(entry => entry.sets.every(set => !set.done))).toBe(true)
  const summary = queue.locator('summary')
  for (const expanded of [true, false]) {
    const motion = await summary.evaluate(async element => {
      element.click()
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const details = element.parentElement
      return details.getAnimations().map(animation => ({ duration: animation.effect.getTiming().duration,
        frames: animation.effect.getKeyframes().map(frame => frame.height) }))
    })
    expect(motion).toHaveLength(1)
    expect(motion[0].duration).toBe(240)
    const [from, to] = motion[0].frames.map(parseFloat)
    expect(expanded ? to > from : to < from).toBe(true)
    await expect(summary).toHaveAttribute('aria-expanded', String(expanded))
    if (expanded) {
      await expect.poll(() => queue.evaluate(element => element.getAnimations().length)).toBe(0)
      const preview = queue.locator('.workout-queue-preview [data-exercise-animation]').first()
      await preview.scrollIntoViewIfNeeded()
      await expect(preview).not.toHaveAttribute('aria-busy', 'true')
      const frame = () => preview.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')
      const initial = await frame()
      await expect.poll(frame).not.toBe(initial)
      const edit = await queue.locator('.workout-exercise-edit').boundingBox()
      const card = await queue.locator('.workout-exercise-tab.is-active').boundingBox()
      expect(edit.x).toBeGreaterThanOrEqual(card.x)
      expect(edit.y).toBeGreaterThanOrEqual(card.y)
      expect(edit.x + edit.width).toBeLessThanOrEqual(card.x + card.width)
      expect(edit.y + edit.height).toBeLessThanOrEqual(card.y + card.height)
    } else await expect(queue).not.toHaveAttribute('open', '')
  }
  for (const selector of ['.wp-series-details', '.wp-exercise-details', '.workout-tools', '.wp-session-details']) {
    const panel = page.locator(selector)
    for (const expanded of [true, false]) {
      const durations = await panel.locator('summary').first().evaluate(async element => {
        element.click()
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        return element.parentElement.getAnimations().map(animation => animation.effect.getTiming().duration)
      })
      expect(durations).toEqual([240])
      await expect(panel.locator('summary').first()).toHaveAttribute('aria-expanded', String(expanded))
      await expect.poll(() => panel.evaluate(element => element.getAnimations().length)).toBe(0)
      if (!expanded) await expect(panel).not.toHaveAttribute('open', '')
    }
  }
})

test('expanded queue edits and removes only today’s exercises and survives reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const original = await prepare(page)
  await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
  const queue = page.locator('.wp-queue-details')
  await queue.locator('summary').click()
  const cardSizes = () => queue.locator('.workout-exercise-tab').evaluateAll(cards => cards.map(card => {
    const rect = card.getBoundingClientRect()
    return { width: rect.width, height: rect.height, nameWidth: card.querySelector('b').getBoundingClientRect().width }
  }))
  const originalSizes = await cardSizes()
  await queue.locator('.workout-exercise-tab').nth(1).click()
  expect(await cardSizes()).toEqual(originalSizes)
  await queue.locator('.workout-exercise-tab').first().click()
  expect(await cardSizes()).toEqual(originalSizes)
  await queue.locator('.workout-exercise-edit').click()
  await page.getByRole('textbox', { name: 'Séries', exact: true }).fill('3')
  await page.getByRole('textbox', { name: /^(Reps|Repetições)$/ }).fill('8')
  await page.getByRole('textbox', { name: 'Peso (kg)', exact: true }).fill('25')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Séries', exact: true })).toHaveCount(0)
  let state = await saved(page)
  expect(state.active.entries[0].sets).toEqual(Array.from({ length: 3 }, () => ({ w: 25, r: 8, done: false })))
  expect(state.routines).toEqual(original.routines)
  await queue.locator('.workout-exercise-remove').click()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(queue.locator('.workout-exercise-tab')).toHaveCount(4)
  state = await saved(page)
  expect(state.active.entries.map(entry => entry.id)).toEqual(original.active.entries.slice(1).map(entry => entry.id))
  expect(state.routines).toEqual(original.routines)
  await queue.locator('.workout-exercise-tab').first().click()
  await queue.locator('.workout-exercise-edit').click()
  await page.getByRole('textbox', { name: 'Séries', exact: true }).fill('2')
  await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Séries', exact: true })).toHaveCount(0)
  await page.reload()
  const restored = await saved(page)
  expect(restored.active.entries[0].sets).toHaveLength(2)
  expect(restored.routines).toEqual(original.routines)
})
