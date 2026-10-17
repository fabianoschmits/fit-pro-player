import { test, expect } from '@playwright/test'
import { seed, stateFixture } from '../../../e2e/fixtures.test.js'

function homeState() {
  const state = stateFixture()
  state.targetW = 80
  state.bodyweight = [
    { d: '2026-10-04', w: 74.5, t: Date.parse('2026-10-04T12:00:00Z') },
    { d: '2026-10-11', w: 75.2, t: Date.parse('2026-10-11T12:00:00Z') },
  ]
  state.workouts = [{
    id: 'glass-recent-workout', routineId: 'e2e-routine', name: 'Treino de teste', d: '2026-10-10',
    start: Date.parse('2026-10-10T12:00:00Z'), end: Date.parse('2026-10-10T12:30:00Z'), vol: 200,
    entries: [{ id: '0025', sets: [{ done: true, w: 20, r: 10 }] }],
  }]
  return state
}

async function enterHome(page, route = '/home') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await seed(page, { state: homeState() })
  await page.goto('/#' + route)
  await expect(page.locator('.home-view')).toBeVisible()
}

async function persistedState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')))
}

async function surfaceStyles(page) {
  return page.evaluate(() => {
    const styles = selector => {
      const style = getComputedStyle(document.querySelector(selector))
      return { background: style.background, color: style.color, backdropFilter: style.backdropFilter }
    }
    return { body: styles('body'), hero: styles('.home-now'), tabbar: styles('.tabbar-bg') }
  })
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth > innerWidth + 2,
    controls: [...document.querySelectorAll('.home-glass-experiment a, .home-glass-experiment button')]
      .filter(element => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
      })
      .map(element => element.getAttribute('aria-label') || element.textContent.trim()),
  }))
  expect(overflow.document).toBe(false)
  expect(overflow.controls).toEqual([])
}

test('experimental home preserves current home content and account state', async ({ page }) => {
  await enterHome(page)
  const currentHome = await page.locator('.home-view').textContent()
  const currentState = await persistedState(page)

  await page.evaluate(() => { location.hash = '/tests/home-glass' })
  const experiment = page.locator('.home-glass-experiment')
  await expect(experiment).toBeVisible()
  await expect(experiment.getByRole('link', { name: 'Voltar ao laboratório de testes', exact: true })).toHaveAttribute('href', '#/console/laboratory')
  await expect(experiment.getByRole('link', { name: 'Comparar com a home atual', exact: true })).toHaveAttribute('href', '#/home')
  await expect(page.locator('[data-tab-key="home"]')).toHaveAttribute('aria-current', 'page')
  await expect(experiment.locator('.home-view')).toHaveText(currentHome)
  await expect(experiment.locator('.home-now h2')).toHaveText('Treino de teste')
  await expect(experiment.locator('.home-weight-reading strong')).toHaveText('75,2')
  await expect(experiment.locator('.home-recent-list')).toContainText('Treino de teste')
  expect(await persistedState(page)).toEqual(currentState)
})

test('week navigation and expanded weight logging keep the existing home behavior', async ({ page }, testInfo) => {
  await enterHome(page, '/tests/home-glass')
  const week = page.locator('.home-week-block')
  const resetWeek = week.getByRole('button', { name: 'Esta semana', exact: true })
  const initialDays = await week.locator('.wday').evaluateAll(days => days.map(day => day.getAttribute('aria-label')))
  await expect(resetWeek).toBeDisabled()
  await week.getByRole('button', { name: 'Semana anterior', exact: true }).click()
  await expect(resetWeek).toBeEnabled()
  expect(await week.locator('.wday').evaluateAll(days => days.map(day => day.getAttribute('aria-label')))).not.toEqual(initialDays)
  await week.getByRole('button', { name: 'Próxima semana', exact: true }).click()
  await expect(resetWeek).toBeDisabled()
  await week.getByRole('button', { name: 'Próxima semana', exact: true }).click()
  await resetWeek.click()
  expect(await week.locator('.wday').evaluateAll(days => days.map(day => day.getAttribute('aria-label')))).toEqual(initialDays)

  const weight = page.locator('.home-weight-block')
  const expand = weight.locator('.home-weight-expand')
  await expect(expand).toHaveAttribute('aria-expanded', 'false')
  await expand.click()
  await expect(expand).toHaveAttribute('aria-expanded', 'true')
  await expect(weight.locator('.home-weight-details')).toBeVisible()
  await weight.getByRole('button', { name: 'Registrar', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog.getByRole('heading', { name: 'Registrar peso corporal', exact: true })).toBeVisible()
  expect(await dialog.evaluate(element => getComputedStyle(element).backdropFilter)).toContain('blur(')
  await dialog.getByRole('button', { name: 'Aumentar em 0,1', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('home-glass-weight-sheet.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(weight.locator('.home-weight-reading strong')).toHaveText('75,3')
  expect((await persistedState(page)).bodyweight.at(-1).w).toBe(75.3)

  await page.locator('.home-recent-list .workout-row').click()
  const detail = page.getByRole('dialog').last()
  const deleteWorkout = detail.getByRole('button', { name: 'Excluir treino', exact: true })
  const dangerColors = await deleteWorkout.evaluate(element => {
    const style = getComputedStyle(element)
    const swatch = document.createElement('span')
    swatch.style.color = style.getPropertyValue('--red')
    return { actual: style.color, expected: swatch.style.color }
  })
  expect(dangerColors.actual).toBe(dangerColors.expected)
  await deleteWorkout.click()
  const confirmation = page.getByRole('dialog').last()
  await expect(confirmation.getByRole('heading', { name: 'Excluir treino?', exact: true })).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect((await persistedState(page)).workouts).toHaveLength(1)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.getByRole('link', { name: 'Comparar com a home atual', exact: true }).click()
  await expect(page).toHaveURL(/#\/home$/)
  await expect(page.locator('.home-weight-reading strong')).toHaveText('75,3')
})

test('leaving the experiment restores existing home surfaces and interactions', async ({ page }) => {
  await enterHome(page)
  const originalStyles = await surfaceStyles(page)
  await page.locator('.home-weight-actions').getByRole('button', { name: 'Registrar', exact: true }).click()
  const originalSheetStyle = await page.getByRole('dialog').last().evaluate(element => ({
    background: getComputedStyle(element).background,
    backdropFilter: getComputedStyle(element).backdropFilter,
  }))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.evaluate(() => { location.hash = '/tests/home-glass' })
  await expect(page.locator('.home-glass-experiment')).toBeVisible()
  expect((await surfaceStyles(page)).hero.backdropFilter).toContain('blur(')
  await page.getByRole('link', { name: 'Comparar com a home atual', exact: true }).click()
  await expect(page.locator('.home-glass-experiment')).toHaveCount(0)
  expect(await surfaceStyles(page)).toEqual(originalStyles)

  await page.getByRole('button', { name: 'Semana anterior', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Esta semana', exact: true })).toBeEnabled()
  await page.locator('.home-weight-actions').getByRole('button', { name: 'Registrar', exact: true }).click()
  const dialog = page.getByRole('dialog').last()
  await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeEnabled()
  expect(await dialog.evaluate(element => ({
    background: getComputedStyle(element).background,
    backdropFilter: getComputedStyle(element).backdropFilter,
  }))).toEqual(originalSheetStyle)
})

test('dark and light glass homes fit small mobile and desktop screens', async ({ page }, testInfo) => {
  const width = testInfo.project.name.includes('mobile') ? 320 : 1440
  await page.setViewportSize({ width, height: 900 })
  await enterHome(page, '/tests/home-glass')
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('gym_state_v1'))
        state.theme = 'light'
        localStorage.setItem('gym_state_v1', JSON.stringify(state))
      })
      await page.reload()
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('.home-glass-experiment .home-now')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`home-glass-${theme}-${width}.png`), fullPage: true })
    await page.locator('.home-weight-expand').click()
    await expect(page.locator('.home-weight-details')).toBeVisible()
    await expectNoHorizontalOverflow(page)
    await page.locator('.home-weight-actions').getByRole('button', { name: 'Registrar', exact: true }).click()
    const sheet = page.getByRole('dialog').last()
    await expect(sheet.getByRole('button', { name: 'Salvar', exact: true })).toBeVisible()
    const bounds = await sheet.boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(-1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
})
