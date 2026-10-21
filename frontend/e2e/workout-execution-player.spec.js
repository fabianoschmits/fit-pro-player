import { test, expect } from '@playwright/test'
import { seed, stateFixture } from './fixtures.test.js'

const entry = (id, target = {}, sets) => ({
  id, target: { mode: 'reps', bodyweight: false, weight: 20, reps: 10, rest: 90, ...target },
  sets: sets || [{ w: 20, r: 10, done: false }, { w: 20, r: 10, done: false }],
})
async function openPlayer(page, entries, options = {}) {
  const state = { ...stateFixture(), ...options }
  state.active = { id: 'real-player-browser-session', d: '2026-10-21', name: 'Treino de teste', routineId: 'e2e-routine', start: Date.now(), durationMs: 0, cur: 0, entries }
  await seed(page, { state })
  await page.goto('/#/workout')
  await expect(page.locator('.wp-exercise-player')).toBeVisible()
}
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).active)

for (const width of [320, 390, 1280]) {
  test(`real execution player keeps its reference surfaces usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 720 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openPlayer(page, [entry('0025', { notes: 'Controle a descida e mantenha a postura.' }), entry('0043')])
    const player = page.locator('.wp-exercise-player')
    await expect(player.locator('.wp-media-card')).toBeVisible()
    await expect(player.locator('.wp-series-track')).toBeVisible()
    await expect(player.locator('.wp-current-controls')).toBeVisible()
    await expect(player.locator('.wp-main-action')).toHaveAccessibleName('Iniciar série 1')
    await expect(player.locator('.wp-main-action')).toBeInViewport({ ratio: 1 })
    expect((await player.locator('.wp-media-card .exmedia').boundingBox()).height).toBeGreaterThanOrEqual(150)
    for (const selector of ['.wp-series-details', '.wp-exercise-details', '.wp-queue-details', '.workout-tools']) {
      const details = page.locator(selector)
      await expect(details).not.toHaveAttribute('open', '')
      await details.locator('summary').click()
      await expect(details).toHaveAttribute('open', '')
      await details.locator('summary').click()
    }
    for (const selector of ['.wp-media-card', '.wp-current-controls', '.wp-main-action', '.wp-exercise-dots']) {
      const rect = await page.locator(selector).boundingBox()
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1)
    }
    const media = await player.locator('.wp-media-card').boundingBox()
    const controls = await player.locator('.wp-current-controls').boundingBox()
    expect(controls.y).toBeGreaterThanOrEqual(media.y + media.height)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false)
    const finish = page.locator('.workout-session-footer').getByRole('button', { name: 'Terminar mais cedo', exact: true })
    await finish.scrollIntoViewIfNeeded()
    await expect(finish).toBeVisible()
    await player.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`real-player-${width}.png`), fullPage: true })
  })
}

test('real sprite frames load and advance, pause and muscle controls preserve playback', async ({ page }) => {
  await openPlayer(page, [entry('0025')])
  const animation = page.locator('.wp-media-card [data-exercise-animation="0025"]')
  await expect(animation).not.toHaveAttribute('aria-busy', 'true')
  await expect.poll(() => animation.locator('img').evaluateAll(images => images.length > 1 && images.every(image => image.complete && image.naturalWidth > 0))).toBe(true)
  const frame = () => animation.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')
  const first = await frame()
  await expect.poll(frame).not.toBe(first)
  // Media ignores the opening click for 450ms so a sheet's trigger cannot pause it.
  await page.waitForTimeout(450)
  await page.locator('.wp-media-card .media-playback').click()
  await expect(animation).not.toHaveClass(/is-playing/)
  const paused = await frame()
  await page.waitForTimeout(400)
  expect(await frame()).toBe(paused)
  await page.locator('.wp-media-card .media-muscles').click()
  await expect(page.locator('.media-muscles-pop')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.media-muscles-pop')).toHaveCount(0)
  await expect(animation).not.toHaveClass(/is-playing/)
  await page.locator('.wp-media-card .media-playback').click()
  await expect(animation).toHaveClass(/is-playing/)
  await page.locator('.wp-media-card .wp-expand').click()
  await expect(page.locator('.ex-detail')).toBeVisible()
  await expect(page.locator('.ex-detail [data-exercise-animation="0025"]')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ex-detail')).toHaveCount(0)
})

test('previous, next and queue dots navigate real entries without completing sets', async ({ page }) => {
  await openPlayer(page, [entry('0025'), entry('0043'), entry('0662', { bodyweight: true }, [{ w: 0, r: 12, done: false }])])
  await expect(page.locator('.wp-exercise-nav--previous')).toBeDisabled()
  await page.locator('.wp-exercise-nav--next').click()
  expect((await saved(page)).cur).toBe(1)
  await expect(page.locator('.wp-main-action')).toHaveAccessibleName('Iniciar série 1')
  await page.locator('.wp-exercise-nav--previous').click()
  expect((await saved(page)).cur).toBe(0)
  await expect(page.locator('.wp-main-action')).toHaveAccessibleName('Iniciar série 1')
  await page.locator('.wp-exercise-dots button').nth(2).click()
  expect((await saved(page)).cur).toBe(2)
  await expect(page.locator('.wp-exercise-nav--next')).toBeDisabled()
  expect((await saved(page)).entries.flatMap(item => item.sets).every(set => !set.done)).toBe(true)
  await page.locator('.wp-exercise-dots button').nth(0).click()
  await page.locator('.wp-main-action').click()
  await expect(page.locator('.wp-exercise-nav--next')).toBeDisabled()
  await page.locator('.wp-main-action.is-executing').click()
  await expect(page.locator('#timer')).toBeVisible()
  await page.locator('.wp-exercise-nav--next').click()
  expect((await saved(page)).cur).toBe(1)
})

test('large metrics preserve pounds, unilateral steps, optional RIR and weight cascading', async ({ page }) => {
  await openPlayer(page, [entry('0292', { side: true, effort: 'rir' })], { displayUnit: 'lb' })
  const controls = page.locator('.wp-current-controls')
  const load = controls.getByRole('textbox', { name: 'Peso (lb)', exact: true })
  expect(Number((await load.inputValue()).replace(',', '.'))).toBeCloseTo(44.1, 0)
  await load.fill('50')
  await controls.getByRole('button', { name: 'Aumentar Reps', exact: true }).click()
  await expect(controls.getByRole('textbox', { name: 'Reps', exact: true })).toHaveValue('12')
  const effort = controls.getByRole('textbox', { name: 'RIR', exact: true })
  await expect(effort).toHaveValue('')
  await effort.fill('0')
  expect((await saved(page)).entries[0].sets[0].rir).toBe(0)
  await effort.fill('')
  const active = await saved(page)
  expect(active.entries[0].sets[0]).not.toHaveProperty('rir')
  expect(active.entries[0].sets[0].r).toBe(12)
  expect(active.entries[0].sets[0].w).toBeCloseTo(22.6796, 3)
  expect(active.entries[0].sets[1].w).toBeCloseTo(active.entries[0].sets[0].w, 5)
})

test('bodyweight and cardio expose their own real metrics', async ({ page }) => {
  await openPlayer(page, [
    entry('0662', { bodyweight: true }, [{ w: 0, r: 12, done: false }]),
    entry('0025', { mode: 'cardio', min: 20, speed: 8 }, [{ min: 20, speed: 8, done: false }]),
  ])
  const controls = page.locator('.wp-current-controls')
  await expect(controls.getByRole('textbox')).toHaveCount(1)
  await expect(controls.getByRole('textbox', { name: 'Reps', exact: true })).toHaveValue('12')
  await page.locator('.wp-exercise-nav--next').click()
  await expect(controls.getByRole('textbox')).toHaveCount(2)
  await controls.getByRole('textbox', { name: 'Duração (min)', exact: true }).fill('25')
  await controls.getByRole('textbox', { name: 'Velocidade (km/h)', exact: true }).fill('9,5')
  expect((await saved(page)).entries[1].sets[0]).toMatchObject({ min: 25, speed: 9.5, done: false })
})

test('superset shows one actual member and alternates before starting rest', async ({ page }) => {
  const first = { ...entry('0025'), sg: 'browser-pair' }
  const second = { ...entry('0043'), sg: 'browser-pair' }
  await openPlayer(page, [first, second])
  await expect(page.locator('.wp-superset-context')).toBeVisible()
  await expect(page.locator('.ss-ex')).toHaveCount(1)
  await page.locator('.wp-main-action').click()
  await page.locator('.wp-main-action.is-executing').click()
  await expect(page.locator('#timer')).toHaveCount(0)
  await expect(page.locator('.wp-exercise-player')).toHaveAttribute('data-exidx', '1')
  expect((await saved(page)).entries.map(item => item.sets.map(set => set.done))).toEqual([[true, false], [false, false]])
  await page.locator('.wp-main-action').click()
  await page.locator('.wp-main-action.is-executing').click()
  await expect(page.locator('#timer')).toBeVisible()
  expect((await saved(page)).entries.map(item => item.sets.map(set => set.done))).toEqual([[true, false], [true, false]])
  await page.locator('#timer .skip').click()
  await expect(page.locator('.wp-main-action')).toHaveAccessibleName('Iniciar série 2')
})
