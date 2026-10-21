import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER, openMainNavigation } from './fixtures.test.js'

async function startPlayer(page) {
  await page.goto('/#/home')
  await expect(page.getByText('Treino de teste', { exact: true }).first()).toBeVisible()
  await openMainNavigation(page)
  await page.locator('[data-tab-key="start"]').click()
  await page.getByRole('button', { name: 'Começar treino', exact: true }).click()
}

test('execution signal animates only while performing and remains static with reduced motion', async ({ page }, testInfo) => {
  const state = stateFixture()
  state.routines[0].ex = [{ id: '0652', sets: 2, reps: 10, weight: 0, bodyweight: true }]
  await seed(page, { state })
  await page.setViewportSize({ width: 390, height: 720 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await startPlayer(page)
  await expect(page.locator('.wp-execution-signal')).toHaveCount(0)
  await page.locator('.wp-main-action').click()
  const signal = page.locator('.wp-execution-signal > span')
  await expect(signal).toBeVisible()
  expect(await signal.evaluate(el => getComputedStyle(el).animationName)).toBe('wp-execution-orbit')
  const first = await signal.evaluate(el => getComputedStyle(el).transform)
  await expect.poll(() => signal.evaluate(el => getComputedStyle(el).transform)).not.toBe(first)
  await page.screenshot({ path: testInfo.outputPath('executing-player.png'), fullPage: true })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await signal.evaluate(el => getComputedStyle(el).animationName)).toBe('none')
  await expect(page.locator('.wp-main-action')).toHaveAccessibleName('Concluir série 1')
  await page.locator('.wp-cancel-set').click()
  await expect(signal).toHaveCount(0)
  await page.locator('.wp-main-action').click()
  await page.locator('.wp-main-action.is-executing').click()
  await expect(signal).toHaveCount(0)
  await expect(page.locator('#timer')).toBeVisible()
})

test('a failed set write retries automatically with the same durable operation and no saving notices', async ({ page }) => {
  const state = stateFixture()
  state.routines[0].ex = [{ id: '0652', sets: 2, reps: 10, weight: 0, bodyweight: true }]
  await seed(page, { state, authenticated: true })
  const date = new Date().toISOString()
  await page.route('https://fitpp-test.supabase.co/rest/v1/athlete_routines**', route => route.fulfill({ json: [{ id: state.routines[0].id, user_id: USER, revision: 1, title: state.routines[0].name, position: 0, prescription: state.routines[0], created_at: date, updated_at: date }] }))
  await page.route('https://fitpp-test.supabase.co/rest/v1/athlete_schedules**', route => route.fulfill({ json: { user_id: USER, revision: 1, mode: 'weekly', schedule: { week: state.week, dayPlan: {} }, updated_at: date } }))
  let session, failed = false
  const attempts = [], accepted = new Set()
  await page.route('https://fitpp-test.supabase.co/rest/v1/workout_sessions**', route => route.fulfill({ json: new URL(route.request().url()).searchParams.get('status') === 'eq.active' ? null : [] }))
  await page.route('https://fitpp-test.supabase.co/rest/v1/rpc/start_workout_session', async route => {
    const args = route.request().postDataJSON()
    session = { id: args.p_session_id, user_id: USER, routine_id: null, assignment_id: null, status: 'active', revision: 1, writer_token: 'test-writer', mass_unit: 'kg', prescription_snapshot: args.p_prescription_snapshot, started_at: new Date().toISOString(), completed_at: null, updated_at: new Date().toISOString() }
    await route.fulfill({ json: session })
  })
  await page.route('https://fitpp-test.supabase.co/rest/v1/rpc/append_workout_operation', async route => {
    const args = route.request().postDataJSON()
    const done = args.p_payload.active?.entries?.[0]?.sets?.[0]?.done
    if (done) {
      attempts.push(args.p_operation_id)
      if (!failed) {
        failed = true
        await route.fulfill({ status: 503, json: { code: 'temporary-unavailable', message: 'Temporary service failure' } })
        return
      }
      accepted.add(args.p_operation_id)
    }
    session = { ...session, revision: session.revision + 1, updated_at: new Date().toISOString() }
    await route.fulfill({ json: session })
  })
  await startPlayer(page)
  await page.locator('.wp-main-action').click()
  await page.locator('.wp-main-action.is-executing').click()
  await expect.poll(() => failed).toBe(true)
  await expect(page.locator('.app-status-global, .workout-save-status')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tentar novamente', exact: true })).toHaveCount(0)
  await expect.poll(() => accepted.size, { timeout: 10000 }).toBe(1)
  expect(attempts.length).toBeGreaterThanOrEqual(2)
  expect(new Set(attempts).size).toBe(1)
  const recovered = await page.evaluate(account => JSON.parse(localStorage.getItem(`fpp_active_session_v1:${account}`)), USER)
  expect(recovered.pendingOperations).toHaveLength(0)
  const local = await page.evaluate(account => JSON.parse(localStorage.getItem(`fpp_account_cache_v1:${account}`)), USER)
  expect(local.state.active.entries[0].sets[0].done).toBe(true)
  await page.goto('/#/settings')
  await expect(page.locator('.app-status-global, .workout-save-status')).toHaveCount(0)
  await expect(page.getByText('Tentar salvar novamente', { exact: true })).toHaveCount(0)
})
