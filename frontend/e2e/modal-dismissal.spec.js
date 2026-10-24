import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { seed, stateFixture, USER } from './fixtures.test.js'

async function openWorkoutHistory(page, dense = false) {
  const state = stateFixture()
  state.workouts = [{
    id: 'completed-workout', name: 'Treino de teste', d: '2026-10-10',
    start: 1791633600000, end: 1791635400000, vol: 200,
    entries: [{ id: '0025', sets: [{ w: 20, r: 10, done: true }] }],
  }]
  if (dense) {
    state.workouts[0].name = 'Push pesado de ombros e peito'
    state.workouts[0].entries = ['0025', '0033', '0041', '0051', '0061'].map(id => ({ id, sets: [{ w: 107.5, r: 10, done: true }] }))
  }
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

test('all share compositions keep five exercise rows and footer within the story', async ({ page }, testInfo) => {
  await openWorkoutHistory(page, true)
  await page.locator('.sheet').getByRole('button', { name: 'Compartilhar treino', exact: true }).click()
  const tabs = page.getByRole('tablist', { name: 'Estilos de compartilhamento' }).getByRole('tab')
  for (let i = 0; i < 11; i++) {
    await tabs.nth(i).click()
    const card = page.locator('.workout-story-canvas')
    const sprite = card.locator('.share-highlight-sprite')
    await expect(sprite).toHaveAttribute('data-exercise-id', '0025')
    await expect(sprite).toHaveAttribute('src', /bench-press\/frame-4/)
    await expect.poll(() => sprite.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect.poll(() => card.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      const selectors = ['.share-card-logo', '.share-card-title', '.share-card-stats', '.share-card-muscles-panel', '.share-card-exercises', '.share-card-footer', '.share-card-exercise:last-child', '.share-exercise-highlight', '.share-highlight-sprite']
      return selectors.every(selector => {
        const rect = el.querySelector(selector).getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1
      })
    })).toBe(true)
    await card.screenshot({ path: testInfo.outputPath(`layout-${i}.png`), animations: 'disabled' })
  }
})

test('shares the compact workout card with its exercise illustration as a PNG', async ({ page }, testInfo) => {
  await openWorkoutHistory(page, true)
  await page.locator('.sheet').getByRole('button', { name: 'Compartilhar treino', exact: true }).click()
  await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }))
  await expect(page.locator('.share-highlight-sprite')).toBeVisible()
  const mapPreview = await page.locator('.workout-story-canvas').evaluate(card => {
    const cardRect = card.getBoundingClientRect()
    const map = card.querySelector('.share-card-map')
    const rect = map.getBoundingClientRect()
    const colors = ['.bm-m.l4', '.bm-sil'].map(selector => getComputedStyle(map.querySelector(selector)).fill.match(/[\d.]+/g).slice(0, 3).map(Number))
    return { x: (rect.left - cardRect.left) * 1080 / cardRect.width, y: (rect.top - cardRect.top) * 1920 / cardRect.height, width: rect.width * 1080 / cardRect.width, height: rect.height * 1920 / cardRect.height, colors }
  })
  const downloaded = page.waitForEvent('download')
  await page.locator('.share-btn-action').click()
  const file = await downloaded
  expect(file.suggestedFilename()).toMatch(/treino-fpp-.*\.png/)
  await file.saveAs(testInfo.outputPath('shared-workout.png'))
  const png = await readFile(testInfo.outputPath('shared-workout.png'))
  expect(png.readUInt32BE(16)).toBe(1080)
  expect(png.readUInt32BE(20)).toBe(1920)
  const matchingPixels = await page.evaluate(async ({ source, map }) => {
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1920
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(Math.round(map.x), Math.round(map.y), Math.round(map.width), Math.round(map.height)).data
    return map.colors.map(color => {
      let count = 0
      for (let i = 0; i < pixels.length; i += 4) {
        if (color.every((channel, index) => Math.abs(channel - pixels[i + index]) <= 5)) count++
      }
      return count
    })
  }, { source: `data:image/png;base64,${png.toString('base64')}`, map: mapPreview })
  for (const count of matchingPixels) expect(count).toBeGreaterThan(20)
  await expect(page.locator('.share-btn-action')).toContainText('Imagem salva')
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
