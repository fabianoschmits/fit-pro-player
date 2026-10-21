import { test, expect } from '@playwright/test'
import { seed } from './fixtures.test.js'

const designs = ['orbita', 'console', 'cartaz', 'percurso', 'deck', 'haltere', 'sprint', 'foco', 'cabine', 'placar']
const route = '/#/console/laboratory/players'
const actions = {
  ready: 'Iniciar série', countdown: 'Executar agora', active: 'Concluir série',
  rest: 'Pular descanso', exerciseDone: 'Próximo exercício', complete: 'Treinar novamente',
}

async function seedAdmin(page) {
  await seed(page, { authenticated: true })
  await page.route('**/rest/v1/user_roles*', request => request.fulfill({
    contentType: 'application/json', body: JSON.stringify([{ role: 'admin' }]),
  }))
}

function captureRuntimeErrors(page) {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /(?:Uncaught|TypeError|ReferenceError|SyntaxError|Invalid hook call|Maximum update depth|React error)/i.test(message.text())) errors.push(message.text())
  })
  return errors
}

async function expectPhase(page, phase) {
  await expect(page.locator('.wpl-preview [data-phase]')).toHaveAttribute('data-phase', phase)
  await expect(page.locator('.wpl-preview .wpl-action')).toHaveAccessibleName(actions[phase])
}

async function expectExerciseAsset(page, exerciseId) {
  const demo = page.locator('.wpl-preview .wpl-exercise-demo')
  await expect(demo).toBeVisible()
  const motion = demo.locator(`[data-exercise-animation="${exerciseId}"]`)
  await expect(motion).toBeVisible()
  await expect(motion.locator('[data-guide-frame].is-active')).toBeVisible()
  await expect.poll(() => motion.locator('[data-guide-frame] img').evaluateAll(images =>
    images.length > 0 && images.every(image => image.complete && image.naturalWidth > 0),
  ), { message: 'every exercise demonstration frame must load successfully' }).toBe(true)
  return motion
}

async function expectControlsFit(page) {
  const overflow = await page.locator('.console-main').evaluate(main => ({
    document: document.documentElement.scrollWidth > innerWidth + 2,
    controls: [...main.querySelectorAll('button,input,select,textarea')].filter(control => {
      const rect = control.getBoundingClientRect()
      if (!rect.width || !rect.height) return false
      const preview = control.closest('.wpl-preview')?.getBoundingClientRect()
      return rect.left < -1 || rect.right > innerWidth + 1 || (preview && (rect.left < preview.left - 1 || rect.right > preview.right + 1))
    }).map(control => control.getAttribute('aria-label') || control.textContent.trim()),
  }))
  expect(overflow.document, 'the page must not scroll horizontally').toBe(false)
  expect(overflow.controls, 'player controls must remain inside the viewport and preview').toEqual([])
}

test('administrators discover the workout players through the laboratory', async ({ page }) => {
  const errors = captureRuntimeErrors(page)
  await seedAdmin(page)
  await page.goto('/#/console/laboratory')
  await page.getByRole('link', { name: /Players de treino/ }).click()
  await expect(page).toHaveURL(/#\/console\/laboratory\/players$/)
  await expect(page.locator('[data-player-choice]')).toHaveCount(10)
  expect(await page.locator('[data-player-choice]').evaluateAll(buttons => buttons.map(button => button.dataset.playerChoice).sort())).toEqual([...designs].sort())
  await expect(page.locator('.wpl-preview')).toBeVisible()
  expect(errors).toEqual([])
})

for (const design of designs) {
  test(`${design}: workout phases, history and reset work without clipping`, async ({ page }, testInfo) => {
    const errors = captureRuntimeErrors(page)
    const width = testInfo.project.name.includes('mobile') ? 360 : 1280
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await seedAdmin(page)
    await page.goto(route)
    await page.locator(`[data-player-choice="${design}"]`).click()
    await expect(page.locator(`.wpl-preview [data-player-design="${design}"]`)).toBeVisible()
    await page.getByRole('button', { name: 'Reiniciar demonstração', exact: true }).click()
    await expectPhase(page, 'ready')
    await expectExerciseAsset(page, '0652')
    await expectControlsFit(page)
    await page.screenshot({ path: testInfo.outputPath(`workout-player-${design}-${width}.png`), fullPage: true })

    const action = page.locator('.wpl-preview .wpl-action')
    await action.click()
    await expectPhase(page, 'countdown')
    await action.click()
    await expectPhase(page, 'active')
    const motion = await expectExerciseAsset(page, '0652')
    await expect(motion).toHaveClass(/\bis-playing\b/)
    await expect(page.locator('.wpl-preview').getByRole('button', { name: 'Pausar demonstração', exact: true })).toBeVisible()
    await expectControlsFit(page)
    const history = page.locator('[data-player-history]')
    await action.click()
    await expectPhase(page, 'rest')
    await expect(history.locator('li')).toHaveCount(1)
    await expect(history.locator('li')).toContainText('Barra fixa')
    await expectControlsFit(page)
    await action.click()
    await expectPhase(page, 'ready')

    await page.locator('[data-stage="exerciseDone"]').click()
    await expectPhase(page, 'exerciseDone')
    await expectControlsFit(page)
    await action.click()
    await expectPhase(page, 'ready')

    await page.locator('[data-stage="complete"]').click()
    await expectPhase(page, 'complete')
    await expectControlsFit(page)
    await action.click()
    await expectPhase(page, 'ready')
    await page.locator('[data-stage="rest"]').click()
    await expectPhase(page, 'rest')
    await page.getByRole('button', { name: 'Reiniciar demonstração', exact: true }).click()
    await expectPhase(page, 'ready')
    expect(errors).toEqual([])
  })
}

test('repetitions and load can be adjusted and the workout clock advances', async ({ page }) => {
  const errors = captureRuntimeErrors(page)
  await seedAdmin(page)
  await page.goto(route)
  await expectPhase(page, 'ready')
  const preview = page.locator('.wpl-preview')
  const readout = preview.locator('.wpl-readout__value')
  await expect(readout).toHaveText('10')
  await preview.getByRole('button', { name: 'Aumentar repetições', exact: true }).click()
  await expect(readout).toHaveText('11')
  await preview.getByRole('button', { name: 'Diminuir repetições', exact: true }).click()
  await expect(readout).toHaveText('10')
  await preview.locator('.wpl-exercise-nav').getByRole('button', { name: 'Exercício seguinte', exact: true }).click()
  const load = preview.locator('[data-player-load]')
  await expect(load).toHaveText(/25\s*kg/)
  await preview.getByRole('button', { name: 'Aumentar carga', exact: true }).click()
  await expect(load).toHaveText(/27[.,]5\s*kg/)
  await preview.getByRole('button', { name: 'Diminuir carga', exact: true }).click()
  await expect(load).toHaveText(/25\s*kg/)
  const clock = preview.locator('.wpl-clock b').first()
  const initialTime = await clock.innerText()
  expect(initialTime).toBe('0:00')
  await preview.locator('.wpl-action').click()
  await expectPhase(page, 'countdown')
  await preview.locator('.wpl-action').click()
  await expectPhase(page, 'active')
  await expect(clock).toHaveText('0:01', { timeout: 2500 })
  await page.getByRole('button', { name: 'Reiniciar demonstração', exact: true }).click()
  await expectPhase(page, 'ready')
  await expect(clock).toHaveText(initialTime)
  expect(errors).toEqual([])
})

test('exercise demonstrations animate, pause independently and follow the chosen exercise', async ({ page }) => {
  const errors = captureRuntimeErrors(page)
  await seedAdmin(page)
  await page.goto(route)
  await page.locator('[data-stage="active"]').click()
  await expectPhase(page, 'active')
  const preview = page.locator('.wpl-preview')
  const motion = await expectExerciseAsset(page, '0652')
  await motion.scrollIntoViewIfNeeded()
  const currentFrame = () => motion.locator('[data-guide-frame].is-active').getAttribute('data-guide-frame')
  const firstFrame = await currentFrame()
  await expect.poll(currentFrame, { timeout: 2000, message: 'the exercise must advance to another animation frame' }).not.toBe(firstFrame)
  await preview.getByRole('button', { name: 'Pausar demonstração', exact: true }).click()
  await expect(motion).not.toHaveClass(/\bis-playing\b/)
  const pausedFrame = await currentFrame()
  // A normal frame lasts 600 ms; remain paused beyond the next scheduled frame.
  await page.waitForTimeout(700)
  expect(await currentFrame()).toBe(pausedFrame)
  await expectPhase(page, 'active')
  await preview.getByRole('button', { name: 'Reproduzir demonstração', exact: true }).click()
  await motion.scrollIntoViewIfNeeded()
  await expect(motion).toHaveClass(/\bis-playing\b/)
  await expect.poll(currentFrame, { timeout: 2000 }).not.toBe(pausedFrame)

  for (const exerciseId of ['0861', '3419']) {
    await page.locator('[data-stage="ready"]').click()
    await preview.locator('.wpl-exercise-nav').getByRole('button', { name: 'Exercício seguinte', exact: true }).click()
    await expectExerciseAsset(page, exerciseId)
    await page.locator('[data-stage="active"]').click()
    await expectPhase(page, 'active')
    const selectedMotion = await expectExerciseAsset(page, exerciseId)
    await expect(selectedMotion).toHaveClass(/\bis-playing\b/)
  }
  expect(errors).toEqual([])
})

test('accounts without the admin role cannot open the player laboratory', async ({ page }) => {
  const errors = captureRuntimeErrors(page)
  await seed(page, { authenticated: true })
  await page.goto(route)
  await expect(page.getByText('Sem acesso', { exact: true })).toBeVisible()
  await expect(page.locator('.wpl-preview')).toHaveCount(0)
  await expect(page.locator('[data-player-choice]')).toHaveCount(0)
  expect(errors).toEqual([])
})
