import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, STUDENT } from './fixtures.test.js'

const snapshot = count => [{ exerciseId: '0025', workSets: count, muscleWeights: { chest: 1, triceps: .4 } }]
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function completed(id, options = {}) {
  const date = options.date || localDate()
  const start = new Date(`${date}T12:00:00`).getTime()
  return { id, d: date, name: `Treino ${id}`, start, end: start + 1800000, durationMs: 1800000, vol: 600,
    comparison: { version: 1, origin: 'personal', planned: snapshot(3), adjusted: snapshot(2), flexApplied: true },
    entries: [{ id: '0025', target: { reps: 10, weight: 20 }, sets: Array.from({ length: 3 }, () => ({ done: true, r: 10, w: 20 })) }], ...options }
}

// These fixtures replace account transport only. The production store, DTO,
// route, comparison engine, body paths, focus management and CSS run unchanged.
async function historyAccount(page, workouts, { theme = 'dark', userId = USER } = {}) {
  const state = stateFixture(); state.theme = theme; state.workouts = workouts
  await seed(page, { authenticated: true, userId, state, rpc: {
    workout_sessions: (_args, { request }) => new URL(request.url()).searchParams.get('status') === 'eq.active' ? null : workouts.map(workout => ({
      id: workout.id, user_id: userId, routine_id: null, assignment_id: null, status: 'completed', revision: 1, writer_token: 'comparison-fixture', mass_unit: 'kg',
      prescription_snapshot: { comparison: workout.comparison }, started_at: new Date(workout.start).toISOString(), completed_at: new Date(workout.end).toISOString(), updated_at: new Date(workout.end).toISOString(),
    })),
    workout_session_operations: workouts.map(workout => ({ session_id: workout.id, user_id: userId, kind: 'session_completed', payload: { workout } })),
  } })
}
const screen = page => page.locator('.training-comparison-view')
const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)

for (const theme of ['dark', 'light']) {
  test(`progress, completed Home, history, session and muscle selection fit ${theme}`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name.includes('mobile')
    await page.setViewportSize({ width: mobile ? 320 : 1280, height: 850 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const latest = completed('recente')
    const old = completed('anterior', { date: '2026-01-01', comparison: undefined })
    await historyAccount(page, [old, latest], { theme })
    await page.goto('/#/progress')
    const preview = page.getByRole('region', { name: 'Mapa do treino', exact: true })
    await expect(preview.getByRole('heading', { name: 'Mapa do treino' })).toBeVisible()
    expect(await preview.evaluate(element => element.previousElementSibling.classList.contains('stats-overview'))).toBe(true)
    await preview.getByRole('button', { name: 'Ver comparativo', exact: true }).click()
    await expect(page).toHaveURL(/training-map\?session=recente$/)
    await expect(screen(page).getByRole('heading', { name: 'Planejado × Realizado', exact: true })).toBeVisible()
    await expect(page.locator('[data-comparison-execution]')).toContainText('150%')
    await expect(page.locator('.tc-flex')).toHaveText('FPP Flex aplicado')
    await expect(page.locator('.tc-map-panel:visible .bm-v')).toHaveCount(mobile ? 1 : 3)
    if (mobile) {
      const stages = page.getByRole('group', { name: 'Etapa do treino' })
      await stages.getByRole('button', { name: 'Original', exact: true }).click()
      await expect(stages.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await stages.getByRole('button', { name: 'Ajustado', exact: true }).click()
      await stages.getByRole('button', { name: 'Realizado', exact: true }).click()
    }
    const actual = page.locator('.tc-map-panel.is-active')
    await actual.getByRole('button', { name: 'Peito', exact: true }).first().click()
    await expect(page.locator('.tc-muscle-detail')).toContainText('Peito')
    await expect(page.locator('.tc-muscle-detail dl')).toContainText('Original3Ajustado2Realizado3')
    await expect(page.locator('.tc-map-legend')).toContainText('0,75')
    await page.getByRole('group', { name: 'Vista do corpo' }).getByRole('button', { name: 'Costas', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Vista do corpo' }).getByRole('button', { name: 'Costas', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const picker = page.getByRole('button', { name: 'Escolher treino', exact: true })
    await picker.click()
    const sheet = page.getByRole('dialog', { name: 'Escolher treino', exact: true })
    await expect(sheet.locator('[data-session-option]')).toHaveCount(2)
    await expect(sheet).toContainText('FPP Flex')
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(picker).toBeFocused()
    await picker.click()
    await page.locator('[data-session-option]').filter({ hasText: 'Treino anterior' }).click()
    await expect(page).toHaveURL(/session=anterior$/)
    await expect(screen(page)).toContainText('Este treino foi registrado antes do novo comparativo. Você ainda pode visualizar os músculos trabalhados.')
    await expect(page.locator('[data-comparison-execution]')).toHaveCount(0)
    await noOverflow(page)
    await page.goto('/#/home')
    await page.getByRole('button', { name: 'Ver músculos treinados', exact: true }).click()
    await expect(page).toHaveURL(/session=recente$/)
    await screen(page).getByRole('button', { name: 'Histórico', exact: true }).click()
    await page.locator('.history-list .workout-row').first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mapa do treino', exact: true }).click()
    await expect(page).toHaveURL(/session=recente$/)
    await expect(page.locator('.tc-map-panel.is-active .tc-bodymap .bm-v')).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`training-comparison-${theme}.png`), fullPage: true })
  })
}

test('direct access chooses the latest session and explicit missing IDs stay unavailable', async ({ page }) => {
  await historyAccount(page, [completed('recent')])
  await page.goto('/#/progress/training-map')
  await expect(page.locator('.tc-session-picker')).toContainText('Treino recent')
  await page.goto('/#/progress/training-map?session=foreign-account')
  await expect(screen(page).getByRole('heading', { name: 'Treino indisponível' })).toBeVisible()
  await expect(page.locator('.tc-summary,.tc-bodymap')).toHaveCount(0)
  await expect(screen(page)).not.toContainText('Treino recent')
})

test('tablet portrait and landscape keep the active map legible with the matching comparison controls', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await historyAccount(page, [completed('tablet')])
  await page.goto('/#/progress/training-map?session=tablet')
  for (const [width, height] of [[768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width, height })
    await expect(page.locator('.tc-map-panel:visible .bm-v')).toHaveCount(width < 1000 ? 1 : 3)
    const stages = page.getByRole('group', { name: 'Etapa do treino' })
    if (width < 1000) {
      await expect(stages).toBeVisible()
      await stages.getByRole('button', { name: 'Original', exact: true }).click()
      await stages.getByRole('button', { name: 'Realizado', exact: true }).click()
    } else await expect(page.locator('.tc-stage-switch')).not.toBeVisible()
    const map = page.locator('.tc-map-panel.is-active .tc-bodymap .bm-v')
    await expect(map).toBeVisible()
    const bounds = await map.boundingBox()
    expect(bounds.width).toBeGreaterThanOrEqual(240)
    expect(bounds.height).toBeGreaterThanOrEqual(340)
    await page.getByRole('group', { name: 'Vista do corpo' }).getByRole('button', { name: 'Costas', exact: true }).click()
    await expect(map.getByRole('button', { name: 'Costas superiores', exact: true }).first()).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`training-comparison-tablet-${width}.png`), fullPage: true })
  }
})

test('empty account has a first-workout action and cannot access another account session', async ({ page }) => {
  await historyAccount(page, [], { userId: STUDENT })
  await page.goto('/#/progress/training-map?session=recent')
  await expect(screen(page)).toContainText('Treino indisponível')
  await page.goto('/#/progress/training-map')
  await expect(screen(page)).toContainText('Seu primeiro comparativo começa com um treino.')
  await page.goto('/#/progress')
  const preview = page.getByRole('region', { name: 'Mapa do treino', exact: true })
  await expect(preview).toContainText('Conclua seu primeiro treino para visualizar seu mapa muscular.')
  await preview.getByRole('button', { name: 'Começar treino', exact: true }).click()
  await expect(page).toHaveURL(/#\/workout$/)
  await noOverflow(page)
})

test('freestyle stays actual-only and long history is progressively limited', async ({ page }) => {
  const free = completed('livre', { comparison: { version: 1, origin: 'freestyle', planned: [], adjusted: [], flexApplied: false } })
  const workouts = Array.from({ length: 17 }, (_, index) => completed(`antigo-${index}`, { date: '2026-01-01' }))
  await historyAccount(page, [...workouts, free])
  await page.goto('/#/progress/training-map?session=livre')
  await expect(screen(page)).toContainText('Este treino livre não tinha uma referência planejada.')
  await expect(page.locator('.tc-map-panel')).toHaveCount(1)
  await expect(page.locator('[data-comparison-execution]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Escolher treino', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Escolher treino', exact: true })
  await expect(sheet).toContainText('Treino livre')
  await expect(sheet.locator('[data-session-option]')).toHaveCount(8)
  await sheet.getByRole('button', { name: 'Ver mais treinos', exact: true }).click()
  await expect(sheet.locator('[data-session-option]')).toHaveCount(16)
  await noOverflow(page)
})

test('a real Home to Flex to completion cycle freezes both references and survives reload', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: testInfo.project.name.includes('mobile') ? 390 : 1280, height: 850 })
  const state = stateFixture()
  state.profile.preferredWorkoutMinutes = 60
  state.routines[0].ex = ['0025', '0047', '0294', '0201', '0043', '0652'].map(id => ({ id, sets: 4, reps: 10, weight: 20, rest: 180 }))
  // No comparison is seeded: production start/review/confirm/finish must create it.
  await seed(page, { state })
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')))
  await page.goto('/#/home')
  await page.locator('.home-now').getByRole('button', { name: 'Começar Treino de teste', exact: true }).click()
  await expect(page).toHaveURL(/#\/workout$/)
  await expect.poll(async () => (await saved()).active?.comparison?.planned?.length).toBe(6)
  expect((await saved()).active.comparison.adjusted).toBeNull()
  await page.locator('.active-workout').getByRole('button', { name: 'Começar treino', exact: true }).click()
  await page.getByRole('dialog', { name: 'Quanto tempo vai treinar hoje?', exact: true }).getByRole('button', { name: '20 min', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar duração', exact: true }).click()
  const queue = page.locator('.wp-queue-details')
  await expect(queue).toHaveAttribute('open', '')
  await expect(queue.locator('.fpp-flex-toggle[aria-pressed="false"]')).not.toHaveCount(0)
  expect((await saved()).active.comparison.adjusted).toBeNull()
  await queue.getByRole('button', { name: 'Confirmar treino', exact: true }).click()
  await expect(page.locator('.set-start-action')).toBeVisible()
  const confirmed = (await saved()).active.comparison
  expect(confirmed.planned).toHaveLength(6)
  expect(confirmed.adjusted.length).toBeGreaterThan(0)
  expect(confirmed.adjusted.length).toBeLessThan(6)
  expect(confirmed.flexApplied).toBe(true)
  await page.locator('.set-start-action').click()
  await page.getByRole('button', { name: 'Concluir série 1', exact: true }).click()
  await page.locator('.workout-session-footer').getByRole('button', { name: 'Terminar mais cedo', exact: true }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar treino', exact: true }).click()
  await page.getByLabel('Nota curta (opcional)', { exact: true }).fill('Comparativo após FPP Flex')
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar treino', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ver mapa do treino', exact: true })).toBeVisible()
  const history = (await saved()).workouts.at(-1)
  expect(history.comparison).toEqual(confirmed)
  expect(history.entries.flatMap(entry => entry.sets).filter(row => row.done)).toHaveLength(1)
  await page.getByRole('button', { name: 'Ver mapa do treino', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`training-map\\?session=${history.id}$`))
  await expect(screen(page).getByRole('heading', { name: 'Planejado × Realizado' })).toBeVisible()
  await expect(page.locator('.tc-flex')).toHaveText('FPP Flex aplicado')
  await page.reload()
  await expect(page.locator('.tc-summary tbody tr').first()).toContainText(`Exercícios6${confirmed.adjusted.length}1`)
  expect((await saved()).workouts.at(-1).comparison).toEqual(confirmed)
  await expect(page.locator('.tc-bodymap .bm-v').first()).toBeAttached()
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('training-comparison-real-flex.png'), fullPage: true })
})
