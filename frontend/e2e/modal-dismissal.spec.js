import { test, expect } from '@playwright/test'
import { seed, stateFixture, USER } from './fixtures.test.js'

async function openWorkoutHistory(page) {
  const state = stateFixture()
  state.workouts = [{
    id: 'completed-workout', name: 'Treino de teste', d: '2026-10-10',
    start: 1791633600000, end: 1791635400000, vol: 200,
    entries: [{ id: '0025', sets: [{ w: 20, r: 10, done: true }] }],
  }]
  await seed(page, { state })
  await page.goto('/#/history')
  await page.locator('.history-list .workout-row').click()
  await expect(page.locator('.sheet')).toBeVisible()
}

test('workout history stays open for inside clicks and closes on its backdrop', async ({ page }) => {
  await openWorkoutHistory(page)
  await page.locator('.sheet h3').click()
  await expect(page.locator('.sheet')).toBeVisible()

  await page.locator('.mback').click({ position: { x: 8, y: 8 }, timeout: 3000 })

  await expect(page.locator('#modal-root')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/history$/)
  await expect(page.locator('.history-list .workout-row')).toBeFocused()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).workouts.length)).toBe(1)
})

test('workout sharing keeps the generated card visible from history', async ({ page }) => {
  await openWorkoutHistory(page)
  await page.locator('.sheet').getByRole('button', { name: 'Compartilhar treino', exact: true }).click()

  const shareSheet = page.locator('.sheet.share-sheet-modal')
  const card = shareSheet.locator('.workout-story-canvas')
  const logo = card.locator('.share-card-logo')
  await expect(shareSheet).toBeVisible()
  await expect(card).toBeVisible()
  await expect(logo).toHaveAttribute('src', '/brand-logo.png')

  const layout = await shareSheet.evaluate(sheet => {
    const preview = sheet.querySelector('.workout-share-preview-area')
    const card = sheet.querySelector('.workout-story-canvas')
    return {
      previewWidth: preview.getBoundingClientRect().width,
      previewHeight: preview.getBoundingClientRect().height,
      cardWidth: card.getBoundingClientRect().width,
      cardHeight: card.getBoundingClientRect().height,
      sheetWidth: sheet.getBoundingClientRect().width,
    }
  })
  expect(layout.previewHeight).toBeGreaterThan(200)
  expect(layout.cardWidth).toBeGreaterThan(layout.previewHeight * 0.5)
  expect(layout.cardHeight).toBeGreaterThan(200)
  expect(layout.sheetWidth).toBeCloseTo(layout.cardWidth, 0)
})

test('workout sharing selects one of eleven card layouts with a horizontal swipe', async ({ page }) => {
  await openWorkoutHistory(page)
  await page.locator('.sheet').getByRole('button', { name: 'Compartilhar treino', exact: true }).click()

  const shareSheet = page.locator('.sheet.share-sheet-modal')
  const picker = shareSheet.getByRole('tablist', { name: 'Estilos de compartilhamento' })
  await expect(picker.getByRole('tab')).toHaveCount(11)
  await expect(picker.getByRole('tab', { selected: true })).toHaveText('Premium')

  const preview = shareSheet.locator('.workout-share-preview-area')
  await preview.dragTo(preview, { sourcePosition: { x: 280, y: 220 }, targetPosition: { x: 30, y: 220 } })

  await expect(picker.getByRole('tab', { selected: true })).toHaveText('Minimal')
})

test('outside clicks dismiss only the top confirmation without deleting the workout', async ({ page }) => {
  await openWorkoutHistory(page)
  await page.locator('.sheet').getByRole('button', { name: 'Excluir treino', exact: true }).click()
  await expect(page.locator('.center')).toBeVisible()
  await page.locator('.center h3').click()
  await expect(page.locator('.center')).toBeVisible()

  await page.locator('.mback').last().click({ position: { x: 8, y: 8 }, timeout: 3000 })

  await expect(page.locator('.center')).toHaveCount(0)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.sheet')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gym_state_v1')).workouts.length)).toBe(1)
  await page.locator('.mback').click({ position: { x: 8, y: 8 } })
  await expect(page.locator('#modal-root')).toHaveCount(0)
  await expect(page).toHaveURL(/#\/history$/)
})

test('professional exercise dialog closes on its backdrop and restores the editor', async ({ page }) => {
  const program = { id: '33333333-3333-4333-8333-333333333333', professional_user_id: USER, title: 'Programa de teste', description: '', archived: false }
  await seed(page, { professional: true, rpc: { programs: [program], program_versions: [] } })
  await page.goto(`/#/professional/programs/${program.id}/edit`)
  const trigger = page.getByRole('button', { name: 'Adicionar exercício', exact: true })
  await trigger.click()
  await page.getByRole('dialog').getByRole('searchbox', { name: 'Pesquisar exercício' }).fill('supino')
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.locator('.dialog-backdrop').click({ position: { x: 8, y: 8 }, timeout: 3000 })

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(trigger).toBeEnabled()
  await expect(page.locator('.professional-program-editor')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`professional/programs/${program.id}/edit$`))
  await trigger.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
